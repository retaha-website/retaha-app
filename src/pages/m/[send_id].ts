// Sprint Wallet · Phase 13 — Click-Tracking-Redirect
//
// GET /m/{send_id}?to={url-encoded-target}
//
// Flow:
//   1. send_id-Lookup → 404 wenn nicht gefunden
//   2. URL-Validation: decoded(to) muss mit "https://" beginnen
//      → 400 Bad Request (Open-Redirect-Schutz)
//   3. Compare-and-Set auf clicked_at:
//        UPDATE ... SET clicked_at=NOW WHERE id=$1 AND clicked_at IS NULL RETURNING id, campaign_id
//      Wenn 1 Row: wir haben den ersten Click gewonnen → click_count++
//      Wenn 0: bereits geklickt (idempotent) — KEIN Counter-Increment
//   4. 302 Redirect zur originalen URL
//
// Best-Effort: wenn step 3 fehlschlaegt (DB-Error) wird trotzdem redirected.
// User darf nicht warten bis Analytics geschrieben ist.
//
// Path: src/pages/api/m/[send_id].ts → URL ist /api/m/{id}?to=...
// In Mails/Pushes nutzen wir /m/{id}?to=... (siehe URL-Wrapping in send.ts/drips.ts).
// Astro mountet api/* unter /api/m/... — Wrapping nutzt dieselbe URL.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../lib/auth';

function badRequest(reason: string) {
  return new Response(`Bad Request: ${reason}`, {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function notFound() {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ params, url }) => {
  const sendId = params.send_id;
  const toRaw = url.searchParams.get('to');

  if (!sendId || !toRaw) return badRequest('missing send_id or to');

  // UUID-Format-Check (defensive — verhindert teure DB-Calls bei garbage-IDs)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sendId)) {
    return notFound();
  }

  // URL-Validation gegen Open-Redirect
  let target: URL;
  try {
    target = new URL(toRaw);
  } catch {
    return badRequest('invalid to-URL');
  }
  if (target.protocol !== 'https:') {
    return badRequest('to-URL must be https');
  }

  const sb = createSupabaseServiceRoleInstance();

  // Step 1: send_id-Lookup für 404-Pfad
  const { data: existing, error: lookupErr } = await sb
    .from('marketing_sends')
    .select('id, campaign_id, clicked_at')
    .eq('id', sendId)
    .maybeSingle();

  if (lookupErr) {
    // DB-Fehler beim Lookup → trotzdem redirect (User soll nicht warten).
    // Log für Diagnostics.
    console.warn('[m/click] lookup failed (continuing redirect):', lookupErr.message);
    return Response.redirect(target.toString(), 302);
  }
  if (!existing) return notFound();

  // Step 2: Compare-and-Set für idempotenten First-Click
  if (!existing.clicked_at) {
    // Conditional UPDATE: returnt 0 Rows wenn zwischenzeitlich ein anderer Request
    // clicked_at gesetzt hat (Race). Nur Sieger inkrementiert den Counter.
    const { data: claimed, error: updErr } = await sb
      .from('marketing_sends')
      .update({ clicked_at: new Date().toISOString() })
      .eq('id', sendId)
      .is('clicked_at', null)
      .select('id, campaign_id')
      .maybeSingle();

    if (updErr) {
      console.warn('[m/click] CAS update failed:', updErr.message);
    } else if (claimed) {
      // Atomic-Increment via RPC (siehe migration 20260613)
      const { error: rpcErr } = await sb.rpc('mc_inc_click', { p_campaign_id: claimed.campaign_id });
      if (rpcErr) console.warn('[m/click] mc_inc_click failed:', rpcErr.message);
    }
  }

  // Step 3: Redirect (immer, auch bei Analytics-Failure)
  return Response.redirect(target.toString(), 302);
};
