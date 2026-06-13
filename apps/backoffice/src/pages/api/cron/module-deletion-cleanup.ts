// Phase 6 — Modul-Datenlöschung nach Grace Period (30 Tage)
//
// Findet fällige module_deletion_schedule-Einträge (status=pending, due <= jetzt),
// löscht die Modul-Daten, schreibt deletion_log, setzt status=deleted.
//
// Auth: Bearer ${CRON_SECRET}  (identisch zu auto-delete-stays)
// Kill-Switch: MODULE_DELETE_ENABLED='true'  (separater Switch — kein Auto-Enable)
//
// Wallet ↔ Marketing CASCADE-Schutz:
//   - Wenn BEIDE Module im selben Lauf: zuerst marketing löschen, dann
//     wallet_passes (CASCADEiert verbleibende marketing_consents).
//   - Wenn NUR wallet (marketing noch aktiv): wallet_passes-PII anonymisieren,
//     Zeile bleibt erhalten damit marketing-FKs intakt bleiben.
//
// Verarbeitungsreihenfolge pro Hotel: marketing → recommendations → nfc_tags
//   → eve → wallet

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { getEnv } from '@retaha/db';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Reihenfolge wichtig: marketing VOR wallet (wegen CASCADE-Schutz)
const DELETE_ORDER = ['marketing', 'recommendations', 'nfc_tags', 'eve', 'wallet'];

async function deleteModuleData(
  hotelId: string,
  moduleKey: string,
  allModulesThisHotel: string[],
  sb: ReturnType<typeof createSupabaseServiceRoleInstance>,
): Promise<void> {
  switch (moduleKey) {
    case 'recommendations': {
      await sb.from('hotel_place_picks').delete().eq('hotel_id', hotelId);
      await sb.from('hotel_place_nearby_cache').delete().eq('hotel_id', hotelId);
      break;
    }

    case 'nfc_tags': {
      await sb.from('nfc_tags').delete().eq('hotel_id', hotelId);
      break;
    }

    case 'eve': {
      // Reihenfolge: abhängige Tabellen zuerst, dann eve_knowledge
      // (eve_knowledge_translations cascadet automatisch über knowledge_id FK)
      await sb.from('eve_message_feedback').delete().eq('hotel_id', hotelId);
      await sb.from('eve_action_log').delete().eq('hotel_id', hotelId);
      await sb.from('eve_knowledge').delete().eq('hotel_id', hotelId);
      // → CASCADE löscht eve_knowledge_translations
      break;
    }

    case 'marketing': {
      // Reihenfolge: Drips → Steps + State via CASCADE, dann Campaigns → Sends via CASCADE
      // marketing_drip_steps und marketing_drip_state cascaden aus marketing_drips (drip_id FK)
      // marketing_sends cascadet aus marketing_campaigns (campaign_id FK)
      // templates zuletzt (marketing_drip_steps.template_id ON DELETE RESTRICT)
      await sb.from('marketing_drips').delete().eq('hotel_id', hotelId);
      // → CASCADE: marketing_drip_steps (drip_id), marketing_drip_state (drip_id)
      await sb.from('marketing_campaigns').delete().eq('hotel_id', hotelId);
      // → CASCADE: marketing_sends (campaign_id)
      await sb.from('marketing_templates').delete().eq('hotel_id', hotelId);
      // marketing_consents: wallet_pass_id FK — werden bei wallet-Löschung kaskadiert
      // oder bleiben erhalten wenn nur marketing gelöscht wird (keine direkte hotel_id)
      break;
    }

    case 'wallet': {
      const marketingAlsoDeleted = allModulesThisHotel.includes('marketing');

      if (marketingAlsoDeleted) {
        // Marketing wurde bereits in dieser Runde gelöscht.
        // Löschen der wallet_passes cascadet noch verbleibende:
        //   marketing_consents (wallet_pass_id), marketing_sends (wallet_pass_id),
        //   marketing_drip_state (wallet_pass_id) — alle bereits via marketing-Schritt weg.
        await sb.from('wallet_passes').delete().eq('hotel_id', hotelId);
      } else {
        // Marketing ist noch aktiv! wallet_passes NICHT löschen — würde
        // marketing_consents/sends/drip_state kaskadiert mitreißen.
        // Stattdessen: PII-Felder nullen, Pass-Status auf 'expired' setzen.
        console.warn(
          `[module-deletion] wallet ohne marketing für hotel=${hotelId} → anonymisiere statt lösche`,
        );
        await sb.from('wallet_passes')
          .update({
            guest_email: 'deleted@retaha.invalid',
            guest_first_name: null,
            guest_last_name: null,
            google_object_id: null,
            google_class_id: null,
            marketing_consent_ip_hash: null,
            state: 'expired',
          })
          .eq('hotel_id', hotelId);
      }
      break;
    }

    default:
      console.warn(`[module-deletion] Unbekannter module_key: ${moduleKey} — übersprungen`);
  }
}

export const GET: APIRoute = async ({ request }) => {
  const expected = getEnv('CRON_SECRET');
  if (!expected) {
    console.warn('[cron/module-deletion-cleanup] CRON_SECRET nicht konfiguriert');
    return json({ ok: false, error: 'CRON_SECRET not configured' }, 503);
  }
  const auth = request.headers.get('authorization') ?? '';
  if (auth !== `Bearer ${expected}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  if (getEnv('MODULE_DELETE_ENABLED') !== 'true') {
    console.info('[cron/module-deletion-cleanup] disabled via MODULE_DELETE_ENABLED');
    return json({ ok: true, skipped: true, reason: 'MODULE_DELETE_ENABLED != true' });
  }

  const startedAt = Date.now();
  const sb = createSupabaseServiceRoleInstance();
  const now = new Date().toISOString();

  const { data: pending, error: loadErr } = await sb
    .from('module_deletion_schedule')
    .select('id, hotel_id, module_key, old_plan, new_plan')
    .eq('status', 'pending')
    .lte('deletion_due_at', now);

  if (loadErr) {
    console.error('[cron/module-deletion-cleanup] load failed:', loadErr);
    return json({ ok: false, error: loadErr.message }, 500);
  }

  if (!pending?.length) {
    return json({ ok: true, processed: 0, elapsed_ms: Date.now() - startedAt });
  }

  console.info(`[cron/module-deletion-cleanup] ${pending.length} fällige Einträge`);

  // Nach Hotel gruppieren
  const byHotel = new Map<string, typeof pending>();
  for (const entry of pending) {
    const list = byHotel.get(entry.hotel_id) ?? [];
    list.push(entry);
    byHotel.set(entry.hotel_id, list);
  }

  let succeeded = 0;
  let failed = 0;

  for (const [hotelId, entries] of byHotel) {
    const moduleKeys = entries.map(e => e.module_key);

    // Sortieren nach DELETE_ORDER (marketing zuerst, wallet zuletzt)
    const sorted = [...entries].sort(
      (a, b) =>
        (DELETE_ORDER.indexOf(a.module_key) ?? 99) -
        (DELETE_ORDER.indexOf(b.module_key) ?? 99),
    );

    for (const entry of sorted) {
      try {
        await deleteModuleData(hotelId, entry.module_key, moduleKeys, sb);

        // Audit-Log
        await sb.from('deletion_log').insert({
          hotel_id: hotelId,
          subject_type: 'module_downgrade',
          subject_ref: entry.module_key,
          deletion_reason: `Plan-Downgrade ${entry.old_plan ?? '?'} → ${entry.new_plan ?? 'canceled'}, 30d Grace abgelaufen`,
          triggered_by: 'cron/module-deletion-cleanup',
          records_deleted: { module_key: entry.module_key },
        });

        await sb
          .from('module_deletion_schedule')
          .update({ status: 'deleted' })
          .eq('id', entry.id);

        console.log(`[cron/module-deletion-cleanup] ✓ hotel=${hotelId} module=${entry.module_key}`);
        succeeded++;
      } catch (err) {
        failed++;
        console.error(
          `[cron/module-deletion-cleanup] ✗ hotel=${hotelId} module=${entry.module_key}:`,
          err,
        );
      }
    }
  }

  const elapsed = Date.now() - startedAt;
  console.info(
    `[cron/module-deletion-cleanup] done · processed=${pending.length} ` +
      `succeeded=${succeeded} failed=${failed} · ${elapsed}ms`,
  );

  return json({ ok: true, processed: pending.length, succeeded, failed, elapsed_ms: elapsed });
};
