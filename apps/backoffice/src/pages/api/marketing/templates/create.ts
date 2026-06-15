// Backoffice · Marketing — Template anlegen
//
// POST /api/marketing/templates/create
// Body: {
//   name, category?,
//   title_default, body_default_html,        // im Hotel-Default-Lang
//   cta_label_default?, cta_url?, hero_image_url?
// }

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { validateVariables, sanitizeMarketingHtml, mergeAndTranslateMarketing, asLanguageCode } from '@retaha/marketing';

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
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: CreateBody;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  // Validation
  const name = body.name?.toString().trim();
  if (!name) return json({ ok: false, error: 'missing_name' }, 400);

  const title = body.title_default?.toString().trim();
  if (!title) return json({ ok: false, error: 'missing_title' }, 400);

  const bodyHtml = body.body_default_html?.toString() ?? '';
  if (!bodyHtml.trim()) return json({ ok: false, error: 'missing_body' }, 400);

  const category = body.category && VALID_CATEGORIES.has(body.category) ? body.category : null;

  // Variable-Allowlist-Check auf title + body
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

  const hotelDefault = asLanguageCode((hotel as any).default_language);

  // Auto-Translation für title, body, cta_label (Variable-protected)
  const ctaLabel = body.cta_label_default?.toString().trim() || '';
  const [titleResult, bodyResult, ctaResult] = await Promise.all([
    mergeAndTranslateMarketing(null, title, hotelDefault, { logLabel: 'marketing_templates.title' }),
    mergeAndTranslateMarketing(null, sanitizedBody, hotelDefault, { logLabel: 'marketing_templates.body' }),
    ctaLabel
      ? mergeAndTranslateMarketing(null, ctaLabel, hotelDefault, { logLabel: 'marketing_templates.cta' })
      : Promise.resolve(null),
  ]);

  const totalUSD = titleResult.cost.estimatedUSD + bodyResult.cost.estimatedUSD + (ctaResult?.cost.estimatedUSD ?? 0);
  console.info(`[marketing/templates/create] auto-translate cost: $${totalUSD.toFixed(5)}`);

  const insert: Record<string, any> = {
    hotel_id: hotel.id,
    name,
    title_i18n: titleResult.i18n,
    body_i18n: bodyResult.i18n,
    cta_label_i18n: ctaResult ? ctaResult.i18n : null,
    cta_url: body.cta_url?.toString().trim() || null,
    hero_image_url: body.hero_image_url?.toString().trim() || null,
    category,
    created_by: user.id,
  };

  const sb = createSupabaseServiceRoleInstance();
  const { data, error } = await sb.from('marketing_templates').insert(insert).select('id').single();
  if (error) {
    console.error('[marketing/templates/create] insert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, id: data!.id });
};
