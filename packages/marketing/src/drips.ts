// Sprint Wallet · Phase 12 — Drip-Campaign-Helpers
//
// 6 Trigger-Typen mit unterschiedlichen Quellen:
//
//   INLINE-Triggers (sofort enqueue in /api/g/wallet/create.ts):
//     - wallet_add              → bei jedem neuen Wallet-Pass
//     - first_visit             → wenn neuer Pass UND visit_count == 1
//     - visit_count_milestone   → bei Re-Visit, wenn neuer Count in
//                                 trigger_config.milestones[] enthalten
//
//   CRON-Triggers (täglich detected im marketing-drips-Cron):
//     - checkout                → stays mit check_out in der Vergangenheit
//     - anniversary             → passes deren first_visit_at MM-DD = heute
//     - seasonal                → drips mit trigger_config.month/day = heute
//
// Idempotenz: marketing_drip_state.PK = (drip_id, wallet_pass_id) — ein Pass
// kann nicht zweimal in dieselbe Drip-Sequenz enqueued werden. UPSERT mit
// ON CONFLICT DO NOTHING reicht — wenn schon enqueued, ignorieren wir das.
//
// MVP-Begrenzung: jede Drip-Sequenz feuert genau EINMAL pro (drip, pass).
// "Yearly anniversary"-Wiederholungen oder "5/10/25 Milestones je separat"
// erfordern entweder mehrere getrennte Drips oder Schema-Änderung — Backlog.

import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { canSendPush } from '@retaha/wallet';
import { addMessageToPass } from '@retaha/wallet';
import { renderVariables, type VariableContext } from '@retaha/wallet';
import { pickI18n } from '@retaha/i18n';
import { asLanguageCode } from '@retaha/i18n';
import { buildOptOutUrl } from '@retaha/wallet';
import { getEnv } from '@retaha/db';
import type { LanguageCode } from '@retaha/i18n';

export type DripTriggerType =
  | 'wallet_add'
  | 'first_visit'
  | 'checkout'
  | 'anniversary'
  | 'visit_count_milestone'
  | 'seasonal';

export interface InlineTriggerPayload {
  newVisitCount?: number;  // für visit_count_milestone
}

// ─── Inline-Trigger ────────────────────────────────────────────────────────

/**
 * Wird von Code-Pfaden aufgerufen, die ein Trigger-Event erzeugen
 * (z.B. /api/g/wallet/create wenn ein Pass entsteht oder visit_count++).
 *
 * Findet alle aktiven Drips dieses Hotels mit passendem trigger_type, prüft
 * trigger_config (bei visit_count_milestone), und enqueued in
 * marketing_drip_state mit ON CONFLICT DO NOTHING.
 *
 * Best-Effort: alle Fehler werden geloggt aber nicht propagiert — ein Drip-
 * Enqueue-Failure darf nie den Caller (z.B. Wallet-Create) scheitern lassen.
 */
export async function triggerDripsForEvent(
  hotelId: string,
  walletPassId: string,
  triggerType: DripTriggerType,
  payload: InlineTriggerPayload = {},
): Promise<{ enqueued: number; skipped: number }> {
  try {
    const sb = createSupabaseServiceRoleInstance();
    const { data: drips, error } = await sb
      .from('marketing_drips')
      .select('id, trigger_config')
      .eq('hotel_id', hotelId)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (error) {
      console.warn(`[drips/trigger ${triggerType}] load failed:`, error.message);
      return { enqueued: 0, skipped: 0 };
    }
    if (!drips || drips.length === 0) return { enqueued: 0, skipped: 0 };

    // Per drip: trigger_config evaluieren
    const eligibleDripIds: string[] = [];
    for (const d of drips) {
      if (triggerType === 'visit_count_milestone') {
        const milestones = (d.trigger_config as any)?.milestones;
        const newCount = payload.newVisitCount;
        if (!Array.isArray(milestones) || typeof newCount !== 'number') continue;
        if (!milestones.includes(newCount)) continue;
      }
      eligibleDripIds.push(d.id);
    }

    if (eligibleDripIds.length === 0) return { enqueued: 0, skipped: drips.length };

    const now = new Date().toISOString();
    const rows = eligibleDripIds.map(dripId => ({
      drip_id: dripId,
      wallet_pass_id: walletPassId,
      triggered_at: now,
      last_step_sent: 0,
    }));

    // ON CONFLICT DO NOTHING via upsert mit ignoreDuplicates
    const { data: inserted, error: insErr } = await sb
      .from('marketing_drip_state')
      .upsert(rows, { onConflict: 'drip_id,wallet_pass_id', ignoreDuplicates: true })
      .select('drip_id');

    if (insErr) {
      console.warn(`[drips/trigger ${triggerType}] upsert failed:`, insErr.message);
      return { enqueued: 0, skipped: eligibleDripIds.length };
    }

    const enqueued = inserted?.length ?? 0;
    if (enqueued > 0) {
      console.info(`[drips/trigger ${triggerType}] hotel=${hotelId.slice(0,8)} pass=${walletPassId.slice(0,8)} enqueued=${enqueued}`);
    }
    return { enqueued, skipped: eligibleDripIds.length - enqueued };
  } catch (err) {
    console.warn(`[drips/trigger ${triggerType}] uncaught:`, (err as Error).message);
    return { enqueued: 0, skipped: 0 };
  }
}

// ─── Cron-Triggers ─────────────────────────────────────────────────────────

interface CronTriggerSummary {
  triggerType: DripTriggerType;
  passesFound: number;
  enqueued: number;
}

/**
 * Checkout-Trigger: passes deren letzter Stay check_out in der Vergangenheit
 * liegt UND noch nicht für diesen Drip enqueued waren.
 *
 * Da wir UNIQUE(drip_id, wallet_pass_id) haben: jeder Pass kriegt jeden
 * Checkout-Drip nur einmal (auch wenn er später nochmal eincheckt). Backlog:
 * per-Stay-Triggering.
 */
async function runCheckoutTrigger(sb: any, today: Date): Promise<CronTriggerSummary[]> {
  const summaries: CronTriggerSummary[] = [];
  const { data: drips } = await sb
    .from('marketing_drips')
    .select('id, hotel_id')
    .eq('trigger_type', 'checkout')
    .eq('is_active', true);

  for (const drip of (drips ?? [])) {
    // Eligible Passes: aktive Pässe des Hotels, deren letzter Visit
    // (last_visit_at < heute) bereits ausgecheckt ist
    const { data: passes } = await sb
      .from('wallet_passes')
      .select('id')
      .eq('hotel_id', drip.hotel_id)
      .eq('state', 'active')
      .lt('last_visit_at', today.toISOString());

    if (!passes || passes.length === 0) {
      summaries.push({ triggerType: 'checkout', passesFound: 0, enqueued: 0 });
      continue;
    }

    const rows = passes.map((p: any) => ({
      drip_id: drip.id, wallet_pass_id: p.id,
      triggered_at: today.toISOString(), last_step_sent: 0,
    }));
    const { data: inserted } = await sb
      .from('marketing_drip_state')
      .upsert(rows, { onConflict: 'drip_id,wallet_pass_id', ignoreDuplicates: true })
      .select('drip_id');

    summaries.push({ triggerType: 'checkout', passesFound: passes.length, enqueued: inserted?.length ?? 0 });
  }
  return summaries;
}

/**
 * Anniversary-Trigger: passes deren first_visit_at heute MM-DD entspricht.
 * Fires ONCE per pass (MVP-Begrenzung — yearly wiederholt: Backlog).
 */
async function runAnniversaryTrigger(sb: any, today: Date): Promise<CronTriggerSummary[]> {
  const summaries: CronTriggerSummary[] = [];
  const { data: drips } = await sb
    .from('marketing_drips')
    .select('id, hotel_id')
    .eq('trigger_type', 'anniversary')
    .eq('is_active', true);

  // Heutiges MM-DD als Filter
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  for (const drip of (drips ?? [])) {
    // Postgres-Filter über EXTRACT — wir nehmen Service-Role-Client mit raw SQL
    const { data: passes, error } = await sb
      .rpc('find_anniversary_passes', { p_hotel_id: drip.hotel_id, p_month: month, p_day: day })
      .select?.();
    // Fallback: ohne RPC simpel via Range-Query auf first_visit_at — wenn
    // RPC nicht vorhanden, machen wir Filter im JS
    let eligible: any[] = [];
    if (error || !passes) {
      const { data: allActive } = await sb
        .from('wallet_passes')
        .select('id, first_visit_at')
        .eq('hotel_id', drip.hotel_id)
        .eq('state', 'active');
      eligible = (allActive ?? []).filter((p: any) => {
        const d = new Date(p.first_visit_at);
        return (d.getUTCMonth() + 1) === month && d.getUTCDate() === day;
      });
    } else {
      eligible = passes;
    }

    if (eligible.length === 0) {
      summaries.push({ triggerType: 'anniversary', passesFound: 0, enqueued: 0 });
      continue;
    }

    const rows = eligible.map((p: any) => ({
      drip_id: drip.id, wallet_pass_id: p.id,
      triggered_at: today.toISOString(), last_step_sent: 0,
    }));
    const { data: inserted } = await sb
      .from('marketing_drip_state')
      .upsert(rows, { onConflict: 'drip_id,wallet_pass_id', ignoreDuplicates: true })
      .select('drip_id');

    summaries.push({ triggerType: 'anniversary', passesFound: eligible.length, enqueued: inserted?.length ?? 0 });
  }
  return summaries;
}

/**
 * Seasonal-Trigger: drips deren trigger_config.month/day heute matchen.
 * Fires für ALLE aktiven Pässe des Hotels (mit Marketing-Consent — wird im
 * Step-Sender per canSendPush gefiltert).
 */
async function runSeasonalTrigger(sb: any, today: Date): Promise<CronTriggerSummary[]> {
  const summaries: CronTriggerSummary[] = [];
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  const { data: drips } = await sb
    .from('marketing_drips')
    .select('id, hotel_id, trigger_config')
    .eq('trigger_type', 'seasonal')
    .eq('is_active', true);

  for (const drip of (drips ?? [])) {
    const cfg = drip.trigger_config as any;
    if (cfg?.month !== month || cfg?.day !== day) {
      continue;  // andere Date — heute nichts zu tun
    }

    const { data: passes } = await sb
      .from('wallet_passes')
      .select('id')
      .eq('hotel_id', drip.hotel_id)
      .eq('state', 'active');

    if (!passes || passes.length === 0) {
      summaries.push({ triggerType: 'seasonal', passesFound: 0, enqueued: 0 });
      continue;
    }

    const rows = passes.map((p: any) => ({
      drip_id: drip.id, wallet_pass_id: p.id,
      triggered_at: today.toISOString(), last_step_sent: 0,
    }));
    const { data: inserted } = await sb
      .from('marketing_drip_state')
      .upsert(rows, { onConflict: 'drip_id,wallet_pass_id', ignoreDuplicates: true })
      .select('drip_id');

    summaries.push({ triggerType: 'seasonal', passesFound: passes.length, enqueued: inserted?.length ?? 0 });
  }
  return summaries;
}

export async function runCronTriggers(today = new Date()): Promise<{
  totalEnqueued: number;
  byType: CronTriggerSummary[];
}> {
  const sb = createSupabaseServiceRoleInstance();
  const all: CronTriggerSummary[] = [
    ...await runCheckoutTrigger(sb, today),
    ...await runAnniversaryTrigger(sb, today),
    ...await runSeasonalTrigger(sb, today),
  ];
  return {
    totalEnqueued: all.reduce((s, x) => s + x.enqueued, 0),
    byType: all,
  };
}

// ─── Step-Sender ───────────────────────────────────────────────────────────

interface DueStep {
  drip_state_id: string;     // synthetic — wir nutzen (drip_id, wallet_pass_id)
  drip_id: string;
  wallet_pass_id: string;
  triggered_at: string;
  last_step_sent: number;
  next_step: {
    id: string;
    template_id: string;
    step_order: number;
    delay_days: number;
  };
}

interface StepSendResult {
  dripId: string;
  walletPassId: string;
  stepOrder: number;
  ok: boolean;
  reason: string;
}

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function buildVarContext(pass: any, hotelName: string, hotelLang: LanguageCode): VariableContext {
  const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-GB', fr: 'fr-FR', es: 'es-ES' };
  const fmt = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString(localeMap[hotelLang] || 'de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
  };
  return {
    first_name: pass.guest_first_name || '',
    last_name: pass.guest_last_name || '',
    hotel_name: hotelName,
    visit_count: pass.visit_count ?? 1,
    last_visit_date: fmt(pass.last_visit_at),
    first_visit_date: fmt(pass.first_visit_at),
  };
}

/**
 * Sendet EINEN Step an EINEN Pass.
 *
 * Flow:
 *   1. canSendPush(pass, 'marketing') — opted_out blockt
 *   2. pickI18n auf template-Body/Title in pass-language
 *   3. renderVariables(ctx, footer.unsubscribe_link)
 *   4. addMessageToPass via Google Wallet API
 *   5. marketing_drip_state.last_step_sent = step_order, last_step_sent_at
 *   6. Wenn last Step: completed_at setzen
 *
 * Failure-Modes:
 *   - pass.state != active → completed_at setzen (Drip auf diesem Pass kaputt)
 *   - canSendPush=false (opted_out) → completed_at setzen (Drip beendet)
 *   - Google API 404 → completed_at + pass.state=opted_out (object_not_found)
 *   - sonstiger Send-Fehler → KEINE State-Änderung, nächster Cron-Tick versucht erneut
 */
async function sendOneStep(step: DueStep): Promise<StepSendResult> {
  const sb = createSupabaseServiceRoleInstance();

  // Pass laden
  const { data: pass } = await sb
    .from('wallet_passes')
    .select('id, hotel_id, state, marketing_consent_given, guest_first_name, guest_last_name, guest_email, visit_count, first_visit_at, last_visit_at, google_object_id')
    .eq('id', step.wallet_pass_id)
    .maybeSingle();
  if (!pass) {
    await markCompleted(step, 'pass_deleted');
    return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: 'pass_deleted' };
  }

  // DSGVO-Gate
  const guard = canSendPush({
    state: pass.state as 'active' | 'opted_out' | 'expired',
    marketingConsentGiven: pass.marketing_consent_given,
    pushType: 'marketing',
  });
  if (!guard.canSend) {
    await markCompleted(step, `guard:${guard.reason}`);
    return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: guard.reason };
  }

  if (!pass.google_object_id) {
    await markCompleted(step, 'pass_not_synced_to_google');
    return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: 'pass_not_synced_to_google' };
  }

  // Template + Hotel laden
  const [{ data: template }, { data: hotel }] = await Promise.all([
    sb.from('marketing_templates').select('id, title_i18n, body_i18n, cta_label_i18n, cta_url').eq('id', step.next_step.template_id).maybeSingle(),
    sb.from('hotels').select('id, name, default_language').eq('id', pass.hotel_id).single(),
  ]);
  if (!template) {
    // Template wurde gelöscht (sollte ON DELETE RESTRICT verhindern, aber safety-Net)
    await markCompleted(step, 'template_deleted');
    return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: 'template_deleted' };
  }

  const hotelDefault = asLanguageCode(hotel?.default_language);
  const passLang = hotelDefault;  // MVP: pass.preferred_language nicht persistiert
  const hotelName = hotel?.name || 'Hotel';

  const titleRaw = pickI18n(template.title_i18n as any, hotelDefault, passLang);
  const bodyHtml = pickI18n(template.body_i18n as any, hotelDefault, passLang);
  const bodyPlain = htmlToPlain(bodyHtml);

  const ctx = buildVarContext(pass, hotelName, passLang);
  const origin = getEnv('PUBLIC_SITE_URL') || 'https://demo.retaha.de';
  const optOutUrl = await buildOptOutUrl(pass.id, origin) || '';
  const renderedTitle = renderVariables(titleRaw, ctx);
  const renderedBody  = renderVariables(bodyPlain, ctx, { unsubscribe_link: optOutUrl });
  const finalBody = optOutUrl ? `${renderedBody}\n\n— Abmelden: ${optOutUrl}` : renderedBody;

  const sendResult = await addMessageToPass({
    walletPassUuid: pass.id,
    hotelId: pass.hotel_id,
    header: renderedTitle,
    body: finalBody,
    messageId: `drip-${step.drip_id}-${pass.id}-${step.next_step.step_order}`,
  });

  if (!sendResult.ok) {
    if (sendResult.status === 'object_not_found') {
      await sb.from('wallet_passes').update({
        state: 'opted_out',
        opted_out_at: new Date().toISOString(),
        opted_out_reason: 'object_404_in_google_wallet',
      }).eq('id', pass.id);
      await markCompleted(step, 'object_not_found');
      return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: 'object_not_found' };
    }
    // Transienter Fehler — KEIN State-Update. Cron versucht es im nächsten Tick.
    return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: false, reason: sendResult.status };
  }

  // Success: last_step_sent bumpen + ggf. completed
  const nowIso = new Date().toISOString();
  await sb.from('marketing_drip_state').update({
    last_step_sent: step.next_step.step_order,
    last_step_sent_at: nowIso,
  }).eq('drip_id', step.drip_id).eq('wallet_pass_id', step.wallet_pass_id);

  // Check: gab es noch einen Step nach diesem?
  const { data: laterSteps } = await sb
    .from('marketing_drip_steps')
    .select('step_order')
    .eq('drip_id', step.drip_id)
    .gt('step_order', step.next_step.step_order)
    .limit(1);
  if (!laterSteps || laterSteps.length === 0) {
    await sb.from('marketing_drip_state').update({ completed_at: nowIso })
      .eq('drip_id', step.drip_id).eq('wallet_pass_id', step.wallet_pass_id);
  }

  return { dripId: step.drip_id, walletPassId: step.wallet_pass_id, stepOrder: step.next_step.step_order, ok: true, reason: 'sent' };
}

async function markCompleted(step: DueStep, reason: string): Promise<void> {
  const sb = createSupabaseServiceRoleInstance();
  await sb.from('marketing_drip_state').update({
    completed_at: new Date().toISOString(),
  }).eq('drip_id', step.drip_id).eq('wallet_pass_id', step.wallet_pass_id);
  console.info(`[drips/step] completed drip=${step.drip_id.slice(0,8)} pass=${step.wallet_pass_id.slice(0,8)} reason=${reason}`);
}

/**
 * Findet alle Drip-State-Rows wo der nächste Step jetzt fällig ist
 * (delay_days seit triggered_at erreicht). PER_RUN_LIMIT begrenzt um nicht
 * den ganzen Cron-Tick zu blockieren.
 */
export async function runDripStepSender(perRunLimit: number = 100): Promise<{
  found: number;
  sent: number;
  failed: number;
  durationMs: number;
}> {
  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();

  // Alle nicht-completed Drip-States laden (ggf. begrenzen — aber wir filtern
  // anschließend im JS auf "fällig", weil delay_days pro Step variiert)
  const { data: states, error } = await sb
    .from('marketing_drip_state')
    .select('drip_id, wallet_pass_id, triggered_at, last_step_sent, last_step_sent_at')
    .is('completed_at', null)
    .order('triggered_at', { ascending: true })
    .limit(perRunLimit * 4);  // Buffer für nicht-fällige

  if (error) {
    console.error('[drips/step-sender] load failed:', error.message);
    return { found: 0, sent: 0, failed: 0, durationMs: Date.now() - startedAt };
  }
  if (!states || states.length === 0) {
    return { found: 0, sent: 0, failed: 0, durationMs: Date.now() - startedAt };
  }

  // Pro State: nächsten Step laden
  const dripIds = Array.from(new Set(states.map(s => s.drip_id)));
  const { data: allSteps } = await sb
    .from('marketing_drip_steps')
    .select('id, drip_id, template_id, step_order, delay_days')
    .in('drip_id', dripIds)
    .order('step_order', { ascending: true });
  const stepsByDrip = new Map<string, any[]>();
  for (const s of (allSteps ?? [])) {
    if (!stepsByDrip.has(s.drip_id)) stepsByDrip.set(s.drip_id, []);
    stepsByDrip.get(s.drip_id)!.push(s);
  }

  // Welche States sind jetzt fällig?
  const due: DueStep[] = [];
  const nowMs = Date.now();
  for (const st of states) {
    const stepsOfDrip = stepsByDrip.get(st.drip_id) ?? [];
    const nextStep = stepsOfDrip.find(s => s.step_order > st.last_step_sent);
    if (!nextStep) {
      // Keine weiteren Steps — als completed markieren (Daten-Reparatur)
      await sb.from('marketing_drip_state').update({
        completed_at: new Date().toISOString(),
      }).eq('drip_id', st.drip_id).eq('wallet_pass_id', st.wallet_pass_id);
      continue;
    }
    const triggeredMs = Date.parse(st.triggered_at);
    const dueAtMs = triggeredMs + nextStep.delay_days * 86_400_000;
    if (dueAtMs > nowMs) continue;
    due.push({
      drip_state_id: `${st.drip_id}:${st.wallet_pass_id}`,
      drip_id: st.drip_id,
      wallet_pass_id: st.wallet_pass_id,
      triggered_at: st.triggered_at,
      last_step_sent: st.last_step_sent ?? 0,
      next_step: nextStep,
    });
    if (due.length >= perRunLimit) break;
  }

  let sent = 0, failed = 0;
  for (const step of due) {
    const result = await sendOneStep(step);
    if (result.ok) sent++;
    else failed++;
  }

  const durationMs = Date.now() - startedAt;
  console.info(
    `[drips/step-sender] found=${due.length} sent=${sent} failed=${failed} · ${durationMs}ms`,
  );
  return { found: due.length, sent, failed, durationMs };
}
