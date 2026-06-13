// Phase 6 — Modul-Lösch-Fahrplan
//
// Minimale Kopie der relevanten PLAN_MODULES-Einträge (nur Module mit echten
// Datentabellen). Quelle der Wahrheit bleibt apps/guest/src/lib/plan-modules.ts.
// Änderungen dort müssen hier synchron gehalten werden.

import { createSupabaseServiceRoleInstance, hotelOwnerFirstName } from '@retaha/auth';
import { routeEmail } from '../email/router';
import { getEnv } from '@retaha/db';

// ── Tier-Ranking (identisch zu plan-modules.ts) ───────────────────────────────
const TIER_RANK: Record<string, number> = { lite: 0, pro: 1, premium: 2, enterprise: 3 };

type ModuleSpec = { minTier: string; addonForTiers?: string[] };

// Nur Module mit eigenen Datentabellen — reine Feature-Flags (loyalty, referrals,
// best_price, microsite, multi_language, pre_stay, stay_pushes) sind ausgelassen.
const MODULE_SPECS: Record<string, ModuleSpec> = {
  recommendations: { minTier: 'pro' },
  nfc_tags:        { minTier: 'pro' },
  eve:             { minTier: 'premium', addonForTiers: ['lite', 'pro'] },
  wallet:          { minTier: 'premium' },
  marketing:       { minTier: 'premium' },
} as const;

export type DeletableModule = keyof typeof MODULE_SPECS;

export const MODULE_LABELS: Record<DeletableModule, string> = {
  recommendations: 'Empfehlungen (Google Places)',
  nfc_tags:        'NFC-Tag Management',
  eve:             'Eve KI-Concierge',
  wallet:          'Wallet-Pass + CRM',
  marketing:       'Marketing (Drips + Kampagnen)',
};

const GRACE_DAYS = 30;

// ── Verfügbarkeit prüfen (nur für Datenlösch-Module) ─────────────────────────
function isAvailable(moduleKey: DeletableModule, plan: string, addons: string[]): boolean {
  const spec = MODULE_SPECS[moduleKey];
  if ((TIER_RANK[plan] ?? 0) >= (TIER_RANK[spec.minTier] ?? 0)) return true;
  if (spec.addonForTiers?.includes(plan) && addons.includes(moduleKey)) return true;
  return false;
}

export function computeLostModules(
  oldPlan: string, oldAddons: string[],
  newPlan: string, newAddons: string[],
): DeletableModule[] {
  return (Object.keys(MODULE_SPECS) as DeletableModule[]).filter(
    key => isAvailable(key, oldPlan, oldAddons) && !isAvailable(key, newPlan, newAddons),
  );
}

export function computeGainedModules(
  oldPlan: string, oldAddons: string[],
  newPlan: string, newAddons: string[],
): DeletableModule[] {
  return (Object.keys(MODULE_SPECS) as DeletableModule[]).filter(
    key => !isAvailable(key, oldPlan, oldAddons) && isAvailable(key, newPlan, newAddons),
  );
}

// ── Lösch-Fahrplan anlegen / Reaktivierung stornieren ────────────────────────
export async function scheduleModuleDeletions(opts: {
  hotelId: string;
  lost: DeletableModule[];
  gained: DeletableModule[];
  trigger: string;
  oldPlan: string;
  newPlan: string | null;
}): Promise<void> {
  const { hotelId, lost, gained, trigger, oldPlan, newPlan } = opts;
  const supabase = createSupabaseServiceRoleInstance();

  // Reaktivierung: pending-Einträge für wiedergewonnene Module stornieren
  if (gained.length > 0) {
    await supabase
      .from('module_deletion_schedule')
      .update({ status: 'canceled' })
      .eq('hotel_id', hotelId)
      .in('module_key', gained)
      .eq('status', 'pending');
    console.log(`[module-deletions] ${hotelId}: ${gained.join(', ')} → canceled (Reaktivierung)`);
  }

  if (lost.length === 0) return;

  const dueAt = new Date(Date.now() + GRACE_DAYS * 86_400_000).toISOString();

  for (const moduleKey of lost) {
    // Kein Duplikat anlegen wenn bereits pending
    const { data: existing } = await supabase
      .from('module_deletion_schedule')
      .select('id')
      .eq('hotel_id', hotelId)
      .eq('module_key', moduleKey)
      .eq('status', 'pending')
      .maybeSingle();

    if (existing) {
      console.log(`[module-deletions] ${hotelId}/${moduleKey}: bereits pending, übersprungen`);
      continue;
    }

    await supabase.from('module_deletion_schedule').insert({
      hotel_id: hotelId,
      module_key: moduleKey,
      deletion_due_at: dueAt,
      triggered_by: trigger,
      old_plan: oldPlan,
      new_plan: newPlan,
    });
  }

  console.log(
    `[module-deletions] ${hotelId}: ${lost.join(', ')} → pending, fällig ${new Date(dueAt).toLocaleDateString('de-DE')}`,
  );

  // Hotelier-Benachrichtigung (Best-Effort, niemals throwen)
  try {
    await sendDowngradeEmail(hotelId, lost, dueAt, oldPlan, newPlan);
  } catch (err) {
    console.warn('[module-deletions] E-Mail-Versand fehlgeschlagen (best-effort):', err);
  }
}

// ── Hotelier-E-Mail ────────────────────────────────────────────────────────────
async function sendDowngradeEmail(
  hotelId: string,
  modules: DeletableModule[],
  dueAt: string,
  oldPlan: string,
  newPlan: string | null,
): Promise<void> {
  const supabase = createSupabaseServiceRoleInstance();

  const [hotelRes, settingsRes] = await Promise.all([
    supabase.from('hotels').select('name').eq('id', hotelId).maybeSingle(),
    supabase.from('hotel_settings').select('notification_email').eq('hotel_id', hotelId).maybeSingle(),
  ]);

  const hotelName = hotelRes.data?.name ?? 'Dein Hotel';
  const notificationEmail = settingsRes.data?.notification_email;
  if (!notificationEmail) {
    console.info('[module-deletions] Keine notification_email für Hotel', hotelId);
    return;
  }

  const firstName = await hotelOwnerFirstName(hotelId);
  const dueDateFormatted = new Date(dueAt).toLocaleDateString('de-DE', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  const moduleList = modules.map(m => `<li>${MODULE_LABELS[m]}</li>`).join('\n');
  const planLabel = newPlan
    ? `von <strong>${oldPlan}</strong> auf <strong>${newPlan}</strong>`
    : `<strong>gekündigt</strong>`;

  const backofficeUrl = getEnv('PUBLIC_BACKOFFICE_URL') ?? 'https://backoffice.retaha.de';

  const html = `
<div style="font-family:sans-serif;max-width:560px;color:#1a1a1a">
  <p>Hallo${firstName ? ` ${firstName}` : ''},</p>
  <p>dein retaha-Plan für <strong>${hotelName}</strong> wurde geändert (${planLabel}).</p>
  <p>Folgende Module sind jetzt nicht mehr aktiv:</p>
  <ul>${moduleList}</ul>
  <p>
    <strong>Deine Daten bleiben bis zum ${dueDateFormatted} erhalten.</strong><br>
    Wenn du deinen Plan bis dahin reaktivierst, gehen keine Daten verloren.
    Danach werden sie automatisch gelöscht.
  </p>
  <p>
    <a href="${backofficeUrl}/subscription"
       style="display:inline-block;padding:10px 20px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px">
      Plan reaktivieren →
    </a>
  </p>
  <p style="color:#888;font-size:12px">
    Fragen? <a href="mailto:hallo@retaha.de">hallo@retaha.de</a>
  </p>
</div>`.trim();

  const recipients = notificationEmail
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);

  await routeEmail({
    type: 'hotelier_notification',
    hotelId,
    to: recipients,
    subject: `retaha: ${modules.length === 1 ? 'Modul' : 'Module'} deaktiviert — Daten werden am ${dueDateFormatted} gelöscht`,
    html,
    fromName: 'retaha',
  });
}
