// Sprint Wallet · Phase 9 — Marketing-Template Update / Archive
//
// PUT    /api/admin/marketing/templates/[id]   → update
// DELETE /api/admin/marketing/templates/[id]   → soft-delete (is_archived=true)
//
// Permission: content.write
// Hard-Delete kommt nicht — Templates können in Drips referenziert sein
// (ON DELETE RESTRICT), Archive bleibt sicher.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance, getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { validateVariables } from '@retaha/marketing';
import { sanitizeMarketingHtml } from '@retaha/marketing';
import { mergeAndTranslateMarketing, asLanguageCode } from '@retaha/marketing';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_CATEGORIES = new Set(['newsletter', 'event', 'promotion', 'seasonal']);

async function loadTemplateForHotel(sb: any, templateId: string, hotelId: string) {
  const { data } = await sb
    .from('marketing_templates')
    .select('id, hotel_id, title_i18n, body_i18n, cta_label_i18n')
    .eq('id', templateId)
    .maybeSingle();
  if (!data || data.hotel_id !== hotelId) return null;
  return data;
}

export const PUT: APIRoute = async ({ cookies, request, params }) => {
  const templateId = params.id;
  if (!templateId) return json({ ok: false, error: 'missing_id' }, 400);

  let body: any;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadTemplateForHotel(sb, templateId, hotel.id);
  if (!existing) return json({ ok: false, error: 'template_not_found' }, 404);

  // Validation analog zu create
  const name = body.name?.toString().trim();
  if (!name) return json({ ok: false, error: 'missing_name' }, 400);
  const title = body.title_default?.toString().trim();
  if (!title) return json({ ok: false, error: 'missing_title' }, 400);
  const bodyHtml = body.body_default_html?.toString() ?? '';
  if (!bodyHtml.trim()) return json({ ok: false, error: 'missing_body' }, 400);

  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : null;

  const validation = validateVariables(`${title} ${bodyHtml}`);
  if (!validation.ok) {
    return json({
      ok: false, error: 'invalid_variables',
      unknown: validation.unknownVariables,
      forbidden: validation.forbiddenVariables,
    }, 400);
  }

  const sanitizedBody = sanitizeMarketingHtml(bodyHtml);
  const hotelDefault = asLanguageCode((hotel as any).default_language);

  // Auto-Translate: behält override-Slots, re-translated alle auto/missing
  const ctaLabel = body.cta_label_default?.toString().trim() || '';
  const [titleResult, bodyResult, ctaResult] = await Promise.all([
    mergeAndTranslateMarketing(existing.title_i18n, title, hotelDefault, { logLabel: `marketing_templates.title:${templateId.slice(0,8)}` }),
    mergeAndTranslateMarketing(existing.body_i18n,  sanitizedBody, hotelDefault, { logLabel: `marketing_templates.body:${templateId.slice(0,8)}` }),
    ctaLabel
      ? mergeAndTranslateMarketing(existing.cta_label_i18n, ctaLabel, hotelDefault, { logLabel: `marketing_templates.cta:${templateId.slice(0,8)}` })
      : Promise.resolve(null),
  ]);

  const totalUSD = titleResult.cost.estimatedUSD + bodyResult.cost.estimatedUSD + (ctaResult?.cost.estimatedUSD ?? 0);
  console.info(`[marketing/templates PUT ${templateId.slice(0,8)}] auto-translate cost: $${totalUSD.toFixed(5)}`);

  const update: Record<string, any> = {
    name,
    title_i18n: titleResult.i18n,
    body_i18n:  bodyResult.i18n,
    cta_label_i18n: ctaResult ? ctaResult.i18n : null,
    cta_url: body.cta_url?.toString().trim() || null,
    hero_image_url: body.hero_image_url?.toString().trim() || null,
    category,
  };

  const { error } = await sb.from('marketing_templates').update(update).eq('id', templateId);
  if (error) {
    console.error('[marketing/templates PUT] update failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies, request, params }) => {
  const templateId = params.id;
  if (!templateId) return json({ ok: false, error: 'missing_id' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'content.write');
  if (auth instanceof Response) return auth;

  const sb = createSupabaseServiceRoleInstance();
  const existing = await loadTemplateForHotel(sb, templateId, hotel.id);
  if (!existing) return json({ ok: false, error: 'template_not_found' }, 404);

  const { error } = await sb
    .from('marketing_templates')
    .update({ is_archived: true })
    .eq('id', templateId);
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, archived: true });
};
