// Sprint Wallet · Phase 9 — Marketing-Template anlegen
//
// POST /api/admin/marketing/templates/create
// Permission: content.write
// Body: {
//   name, category?,
//   title_default, body_default_html,        // im Hotel-Default-Lang
//   cta_label_default?, cta_url?, hero_image_url?
// }
//
// Phase 11 (Group 2) wird hier die Auto-Translation einhängen — aktuell
// speichern wir das Template nur in der Default-Sprache des Hotels.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '../../../../../lib/auth';
import { requirePermission } from '../../../../../lib/auth/require-permission';
import { validateVariables } from '../../../../../lib/marketing/variables';
import { sanitizeMarketingHtml } from '../../../../../lib/marketing/html-sanitize';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

interface CreateBody {
  name?: string;
  category?: string;
  title_default?: string;
  body_default_html?: string;
  cta_label_default?: string;
  cta_url?: string;
  hero_image_url?: string;
}

const VALID_CATEGORIES = new Set(['newsletter', 'event', 'promotion', 'seasonal']);

export const POST: APIRoute = async ({ cookies, request }) => {
  let body: CreateBody;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  // Validation
  const name = body.name?.toString().trim();
  if (!name) return json({ ok: false, error: 'missing_name' }, 400);

  const title = body.title_default?.toString().trim();
  if (!title) return json({ ok: false, error: 'missing_title' }, 400);

  const bodyHtml = body.body_default_html?.toString() ?? '';
  if (!bodyHtml.trim()) return json({ ok: false, error: 'missing_body' }, 400);

  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : null;

  // Variable-Allowlist-Check auf title + body (PLAIN-Variante)
  const fullText = `${title} ${bodyHtml}`;
  const validation = validateVariables(fullText);
  if (!validation.ok) {
    return json({
      ok: false, error: 'invalid_variables',
      unknown: validation.unknownVariables,
      forbidden: validation.forbiddenVariables,
    }, 400);
  }

  // HTML sanitizen
  const sanitizedBody = sanitizeMarketingHtml(bodyHtml);

  const hotelDefault = (hotel as any).default_language || 'de';
  const now = new Date().toISOString();
  const i18nWrap = (value: string) => ({
    [hotelDefault]: { value, source: 'original', updated_at: now },
  });

  const insert: Record<string, any> = {
    hotel_id: hotel.id,
    name,
    title_i18n: i18nWrap(title),
    body_i18n: i18nWrap(sanitizedBody),
    cta_label_i18n: body.cta_label_default
      ? i18nWrap(body.cta_label_default.toString().trim())
      : null,
    cta_url: body.cta_url?.toString().trim() || null,
    hero_image_url: body.hero_image_url?.toString().trim() || null,
    category,
    created_by: auth.userId,
  };

  const sb = createSupabaseServiceRoleInstance();
  const { data, error } = await sb.from('marketing_templates').insert(insert).select('id').single();
  if (error) {
    console.error('[marketing/templates/create] insert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, id: data!.id });
};
