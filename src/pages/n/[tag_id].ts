// Sprint H · Group 3 — NFC-Tag-Router
//
// GET /n/{tag_id} — wird vom NFC-Chip aufgerufen
//
// Flow:
//   1. Atomic-Increment via nfc_scan-RPC + Auth-Check (is_active)
//   2. 4 target_types routen:
//      - guest_stay    → 302 zu /g/{stay.access_token}
//      - hotel_general → 302 zu aktivem Stay > Showcase > /n/welcome
//      - room          → Lookup current stay via rooms.room_number → 302 oder /n/welcome
//      - custom_url    → 302 zu target_value.url (https-only Validation)

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../lib/auth';

function redirect(url: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: url } });
}

function notFound(): Response {
  return new Response('Not Found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

function badRequest(reason: string): Response {
  return new Response(`Bad Request: ${reason}`, {
    status: 400,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

export const GET: APIRoute = async ({ params }) => {
  const tagId = params.tag_id;
  if (!tagId) return badRequest('missing tag_id');

  // UUID-Format-Check (defensive, gegen garbage)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tagId)) {
    return notFound();
  }

  const sb = createSupabaseServiceRoleInstance();

  // Atomic scan + Auth (is_active=true) + Routing-Target return
  const { data: tags, error } = await sb.rpc('nfc_scan', { p_tag_id: tagId });
  if (error) {
    console.warn('[nfc-scan] rpc failed:', error.message);
    return notFound();
  }
  const tag = (Array.isArray(tags) ? tags[0] : tags) as
    | { id: string; hotel_id: string; target_type: string; target_value: any }
    | undefined;
  if (!tag) return notFound();

  switch (tag.target_type) {
    // ── guest_stay: Token aus target_value oder stay_id-Lookup ──────────
    case 'guest_stay': {
      const stayId = tag.target_value?.stay_id;
      if (!stayId) {
        return redirect(`/n/welcome?hotel=${tag.hotel_id}`);
      }
      const { data: stay } = await sb
        .from('stays').select('access_token, is_active')
        .eq('id', stayId).eq('is_active', true).maybeSingle();
      if (!stay?.access_token) {
        return redirect(`/n/welcome?hotel=${tag.hotel_id}`);
      }
      return redirect(`/g/${stay.access_token}`);
    }

    // ── room: finde laufenden Stay via room_number ──────────────────────
    case 'room': {
      const roomNumber = tag.target_value?.room_number;
      if (!roomNumber) return redirect(`/n/welcome?hotel=${tag.hotel_id}`);
      const nowIso = new Date().toISOString();
      const { data: stays } = await sb
        .from('stays')
        .select('access_token, check_in, check_out, rooms!inner(room_number)')
        .eq('hotel_id', tag.hotel_id)
        .eq('is_active', true)
        .ilike('rooms.room_number', String(roomNumber))
        .lte('check_in', nowIso)
        .gt('check_out', nowIso)
        .order('check_in', { ascending: false })
        .limit(1);
      const first = (stays ?? [])[0];
      if (first?.access_token) return redirect(`/g/${first.access_token}`);
      // Kein laufender Stay in diesem Zimmer → Welcome-Page mit Zimmer-Hinweis
      return redirect(`/n/welcome?hotel=${tag.hotel_id}&room=${encodeURIComponent(String(roomNumber))}`);
    }

    // ── hotel_general: aktiver Stay > Showcase > Welcome ────────────────
    case 'hotel_general': {
      const nowIso = new Date().toISOString();
      // (a) Aktiven Stay finden (FIFO älteste check_in)
      const { data: stays } = await sb
        .from('stays')
        .select('access_token')
        .eq('hotel_id', tag.hotel_id)
        .eq('is_active', true)
        .lte('check_in', nowIso)
        .gt('check_out', nowIso)
        .order('check_in', { ascending: true })
        .limit(1);
      if (stays?.[0]?.access_token) return redirect(`/g/${stays[0].access_token}`);

      // (b) Aktive Showcase-Session
      const { data: showcase } = await sb
        .from('showcase_sessions')
        .select('token')
        .eq('hotel_id', tag.hotel_id)
        .eq('is_active', true)
        .gt('expires_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1);
      if (showcase?.[0]?.token) return redirect(`/g/${showcase[0].token}`);

      // (c) Empty-State
      return redirect(`/n/welcome?hotel=${tag.hotel_id}`);
    }

    // ── custom_url: https-only Validation + Redirect ────────────────────
    case 'custom_url': {
      const url = String(tag.target_value?.url ?? '');
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return badRequest('custom_url must be https');
        return redirect(parsed.toString());
      } catch {
        return badRequest('invalid custom_url');
      }
    }

    default:
      return notFound();
  }
};
