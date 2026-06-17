// POST /api/checkout/complete
// Self-Checkout bestätigen — mit Mews-Sync (graceful fallback)
// Auth: Stay-Session-Cookie
// Body: { stay_token: string }
//
// Phase 4.2: UI funktional. Mews-Integration: TRY/CATCH mit Audit-Log.
// Phase 7: Echter Mews-FK-Fix + Retry-Logic für pending mews_sync.

import type { APIRoute } from 'astro';
import { getStaySession, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { isDemoSession } from '../../../lib/showcase/session';
import { awardStayPoints } from '@retaha/loyalty';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  // Auth via Stay-Session-Cookie
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);

  let body: { stay_token?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const sbSr = createSupabaseServiceRoleInstance();

  // ── Demo-Checkout (Showcase-Session) ─────────────────────────────────────
  if (isDemoSession(session)) {
    const { data: sc } = await sbSr.from('showcase_sessions')
      .select('id, demo_data')
      .eq('id', session.stay_id)
      .maybeSingle();

    if (!sc) return json({ ok: false, error: 'stay_not_found' }, 404);

    const dd = (sc.demo_data ?? {}) as any;
    if (dd.checked_out_at_sim) {
      return json({ ok: true, already_done: true });
    }

    const checkedOutAt = new Date().toISOString();
    await sbSr.from('showcase_sessions').update({
      demo_data: { ...dd, checked_out_at_sim: checkedOutAt },
    }).eq('id', sc.id);

    return json({ ok: true, checked_out_at: checkedOutAt, mews_sync: 'skipped' });
  }

  // ── Echter Stay ───────────────────────────────────────────────────────────
  // Stay laden + validieren
  const { data: stayRow, error: stayErr } = await sbSr
    .from('stays')
    .select('id, hotel_id, guest_id, check_in, check_out, checked_out_at, is_active')
    .eq('id', session.stay_id)
    .maybeSingle();

  if (stayErr || !stayRow) {
    return json({ ok: false, error: 'stay_not_found' }, 404);
  }

  // Schon ausgecheckt?
  if ((stayRow as any).checked_out_at) {
    return json({ ok: true, already_done: true });
  }

  // Checkout-Zeit prüfen (nur am oder nach Abreise-Tag)
  const checkoutDate = new Date((stayRow as any).check_out);
  const now = new Date();
  const checkoutDay = checkoutDate.toDateString();
  const today = now.toDateString();
  const isPastCheckout = now.getTime() > checkoutDate.getTime();

  if (checkoutDay !== today && !isPastCheckout) {
    return json({ ok: false, error: 'too_early', checkout_date: (stayRow as any).check_out }, 400);
  }

  const checkedOutAt = now.toISOString();

  // Stay als ausgecheckt markieren
  const { error: updateErr } = await sbSr
    .from('stays')
    .update({
      checked_out_at: checkedOutAt,
      is_active: false,
      state: 'Processed',
    })
    .eq('id', session.stay_id);

  if (updateErr) {
    return json({ ok: false, error: updateErr.message }, 500);
  }

  // ── Loyalty: Punkte pro Nacht gutschreiben (best-effort, idempotent) ──────
  // Gated auf features.loyalty (in awardStayPoints), blockiert den Checkout nie.
  // Demo-/Showcase-Sessions haben keinen echten guests-Row → deren Earning wird
  // am Anzeige-Zeitpunkt simuliert (Phase 3), daher hier nur der echte Stay-Pfad.
  try {
    await awardStayPoints(sbSr, {
      hotelId: (stayRow as any).hotel_id,
      guestId: (stayRow as any).guest_id,
      stayId: session.stay_id,
      checkIn: (stayRow as any).check_in,
      checkOut: (stayRow as any).check_out,
    });
  } catch (e) {
    console.warn('[checkout/complete] loyalty award failed (non-fatal):', (e as Error).message);
  }

  // Mews-Sync: TRY/CATCH — Fehler blockiert Gast nicht
  let mewsSyncStatus: 'synced' | 'pending' | 'skipped' = 'skipped';
  try {
    const mewsUrl = import.meta.env.MEWS_API_URL;
    const mewsToken = import.meta.env.MEWS_CLIENT_TOKEN;

    if (mewsUrl && mewsToken) {
      // Audit-Log: mews_sync_pending (Phase 7 pickt das auf für Retry)
      // Hier: vereinfachter Marker — kein echter Mews-API-Call in Phase 4
      // Phase 7 implementiert den echten Mews-Departure-Endpoint
      mewsSyncStatus = 'pending';

      await sbSr.from('checkout_audit_log').upsert({
        stay_id: session.stay_id,
        hotel_id: session.hotel_id,
        checked_out_at: checkedOutAt,
        mews_sync_status: 'pending',
        source: 'self_checkout',
      }).select();
    }
  } catch {
    // Mews nicht verfügbar — kein Fehler für Gast, Audit-Log als pending
    mewsSyncStatus = 'pending';
    try {
      await sbSr.from('checkout_audit_log').upsert({
        stay_id: session.stay_id,
        hotel_id: session.hotel_id,
        checked_out_at: checkedOutAt,
        mews_sync_status: 'error',
        source: 'self_checkout',
      }).select();
    } catch {
      // Audit-Log-Fehler nicht an Gast weitergeben
    }
  }

  return json({ ok: true, checked_out_at: checkedOutAt, mews_sync: mewsSyncStatus });
};
