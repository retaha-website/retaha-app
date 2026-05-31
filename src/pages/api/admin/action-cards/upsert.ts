// Sprint E7 Phase 3 — Action-Card upsert (create + update)
//
// POST JSON body:
//   id?: UUID (wenn vorhanden → UPDATE, sonst INSERT)
//   card_type: 'internal_action' | 'external_link' | 'info' | 'phone' | 'email'
//   action_target?: string
//   title_de: string (NOT NULL)
//   title_en|fr|es?, subtitle_*?, eyebrow_*?, cta_*?
//   card_class?: string
//   is_published?: boolean
//
// Returns: { ok, id, isNew, error? }

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance } from '../../../../lib/auth';

const VALID_TYPES = ['internal_action', 'external_link', 'info', 'phone', 'email'] as const;
type CardType = typeof VALID_TYPES[number];

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function validateTarget(card_type: CardType, target: string | null): string | null {
  if (card_type === 'info') return null; // info erlaubt explizit kein target
  if (card_type === 'internal_action') {
    if (!target) return 'action_target required for internal_action';
    return null;
  }
  if (card_type === 'external_link') {
    if (!target) return 'URL required';
    try { const u = new URL(target); if (!['http:','https:'].includes(u.protocol)) return 'http/https only'; }
    catch { return 'Invalid URL'; }
    return null;
  }
  if (card_type === 'phone') {
    if (!target || !/^[+\d\s()\-./]{4,}$/.test(target)) return 'Invalid phone number';
    return null;
  }
  if (card_type === 'email') {
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) return 'Invalid email';
    return null;
  }
  return null;
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'No hotel for user' }, 403);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON' }, 400); }

  // Required fields
  if (!body.card_type || !VALID_TYPES.includes(body.card_type)) {
    return json({ ok: false, error: 'Invalid card_type' }, 400);
  }
  if (!body.title_de || typeof body.title_de !== 'string' || !body.title_de.trim()) {
    return json({ ok: false, error: 'title_de required' }, 400);
  }
  const target = (body.action_target ?? '').toString().trim() || null;
  const targetErr = validateTarget(body.card_type, target);
  if (targetErr) return json({ ok: false, error: targetErr }, 400);

  const sb = createSupabaseServerInstance(cookies, request);

  const fields: Record<string, any> = {
    hotel_id: hotel.id,
    card_type: body.card_type,
    action_target: target,
    title_de: body.title_de.trim(),
    title_en: body.title_en?.trim() || null,
    title_fr: body.title_fr?.trim() || null,
    title_es: body.title_es?.trim() || null,
    subtitle_de: body.subtitle_de?.trim() || null,
    subtitle_en: body.subtitle_en?.trim() || null,
    subtitle_fr: body.subtitle_fr?.trim() || null,
    subtitle_es: body.subtitle_es?.trim() || null,
    eyebrow_de: body.eyebrow_de?.trim() || null,
    eyebrow_en: body.eyebrow_en?.trim() || null,
    eyebrow_fr: body.eyebrow_fr?.trim() || null,
    eyebrow_es: body.eyebrow_es?.trim() || null,
    cta_de: body.cta_de?.trim() || null,
    cta_en: body.cta_en?.trim() || null,
    cta_fr: body.cta_fr?.trim() || null,
    cta_es: body.cta_es?.trim() || null,
    card_class: (body.card_class ?? 'rec-anthrazit').toString(),
    is_published: body.is_published !== false,
  };

  if (body.id) {
    // UPDATE
    const { data, error } = await sb
      .from('hotel_action_cards')
      .update(fields)
      .eq('id', body.id)
      .eq('hotel_id', hotel.id)
      .select('id')
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    if (!data) return json({ ok: false, error: 'Not found or forbidden' }, 404);
    return json({ ok: true, id: data.id, isNew: false });
  }

  // INSERT — sort_order = max + 1
  const { data: maxRow } = await sb
    .from('hotel_action_cards')
    .select('sort_order')
    .eq('hotel_id', hotel.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  fields.sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await sb
    .from('hotel_action_cards')
    .insert(fields)
    .select('id')
    .single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, id: data.id, isNew: true });
};
