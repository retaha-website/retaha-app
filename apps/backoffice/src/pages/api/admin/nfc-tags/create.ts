// Sprint H · Group 3 — NFC-Tag erstellen (Single + Bulk)
//
// POST /api/admin/nfc-tags/create
// Body single: { label, target_type, target_value? }
// Body bulk:   { bulk: { mode: 'room_range', from: 101, to: 110, label_prefix?: 'Zimmer' } }
// Permission: settings.write

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_TYPES = new Set(['guest_stay', 'hotel_general', 'room', 'custom_url']);

interface SingleBody {
  label?: string;
  target_type?: string;
  target_value?: any;
}

interface BulkBody {
  bulk: {
    mode: 'room_range';
    from: number;
    to: number;
    label_prefix?: string;
  };
}

function validateTargetValue(type: string, value: any): { ok: true; value: any } | { ok: false; error: string } {
  if (type === 'guest_stay') {
    if (!value?.stay_id || typeof value.stay_id !== 'string') {
      return { ok: false, error: 'guest_stay needs target_value.stay_id' };
    }
    return { ok: true, value: { stay_id: value.stay_id } };
  }
  if (type === 'room') {
    if (!value?.room_number) return { ok: false, error: 'room needs target_value.room_number' };
    return { ok: true, value: { room_number: String(value.room_number) } };
  }
  if (type === 'custom_url') {
    if (!value?.url) return { ok: false, error: 'custom_url needs target_value.url' };
    try {
      const u = new URL(String(value.url));
      if (u.protocol !== 'https:') return { ok: false, error: 'custom_url must be https' };
      return { ok: true, value: { url: u.toString() } };
    } catch { return { ok: false, error: 'invalid custom_url' }; }
  }
  // hotel_general: kein target_value nötig
  return { ok: true, value: null };
}

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: SingleBody & Partial<BulkBody>;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();

  // ── Bulk-Mode (Zimmer-Range) ─────────────────────────────────────────
  if (body.bulk) {
    const b = body.bulk;
    if (b.mode !== 'room_range') return json({ ok: false, error: 'unsupported_bulk_mode' }, 400);
    if (!Number.isInteger(b.from) || !Number.isInteger(b.to) || b.to < b.from) {
      return json({ ok: false, error: 'invalid_range' }, 400);
    }
    if (b.to - b.from > 200) return json({ ok: false, error: 'range_too_large' }, 400);

    const prefix = (b.label_prefix?.trim() || 'Zimmer');
    const rows = [] as any[];
    for (let n = b.from; n <= b.to; n++) {
      rows.push({
        hotel_id: hotel.id,
        label: `${prefix} ${n}`,
        target_type: 'room',
        target_value: { room_number: String(n) },
      });
    }
    const { data, error } = await sb.from('nfc_tags').insert(rows).select('id');
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, created: data?.length ?? 0 });
  }

  // ── Single-Mode ──────────────────────────────────────────────────────
  const label = body.label?.toString().trim();
  const type = body.target_type;
  if (!label) return json({ ok: false, error: 'missing_label' }, 400);
  if (!type || !VALID_TYPES.has(type)) return json({ ok: false, error: 'invalid_target_type' }, 400);

  const tvCheck = validateTargetValue(type, body.target_value);
  if (!tvCheck.ok) return json({ ok: false, error: tvCheck.error }, 400);

  const { data, error } = await sb.from('nfc_tags').insert({
    hotel_id: hotel.id,
    label,
    target_type: type,
    target_value: tvCheck.value,
  }).select('id').single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data!.id });
};
