// Backoffice · Marketing — Campaign erstellen
//
// POST /api/marketing/campaigns/create
// Body: {
//   name,
//   template_id?,                  // optional: kopiert title/body/cta vom Template
//   target_filter?: { language?, min_visit_count? },
//   scheduled_at?: ISO             // wenn gesetzt: status=scheduled, sonst draft
// }
//
// Ohne template_id: Ad-hoc-Campaign — Body übernimmt zusätzlich
// title_default, body_default_html, cta_label_default, cta_url, hero_image_url
// und triggert Auto-Translate.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { validateVariables, sanitizeMarketingHtml, mergeAndTranslateMarketing, asLanguageCode } from '@retaha/marketing';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_CHANNELS = new Set(['wallet_push', 'email']);

interface Body {
  name?: string;
  channels?: string[];
  template_id?: string;
  target_filter?: { language?: string; min_visit_count?: number };
  scheduled_at?: string;
  // Ad-hoc Felder (nur wenn template_id fehlt):
  title_default?: string;
  body_default_html?: string;
  cta_label_default?: string;
  cta_url?: string;
  hero_image_url?: string;
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ ok: false, error: 'unauthorized' }, 401);

  let body: Body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const name = body.name?.toString().trim();
  if (!name) return json({ ok: false, error: 'missing_name' }, 400);

  const rawChannels = Array.isArray(body.channels) ? body.channels : ['wallet_push', 'email'];
  const channels = rawChannels.filter(c => VALID_CHANNELS.has(c));
  if (channels.length === 0) return json({ ok: false, error: 'invalid_channels' }, 400);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const sb = createSupabaseServiceRoleInstance();
  const hotelDefault = asLanguageCode((hotel as any).default_language);

  let titleI18n: any, bodyI18n: any, ctaLabelI18n: any | null, ctaUrl: string | null, heroUrl: string | null;

  if (body.template_id) {
    // ── Aus Template kopieren ──────────────────────────────────────────────
    const { data: tpl } = await sb
      .from('marketing_templates')
      .select('id, hotel_id, title_i18n, body_i18n, cta_label_i18n, cta_url, hero_image_url, is_archived')
      .eq('id', body.template_id)
      .maybeSingle();
    if (!tpl || tpl.hotel_id !== hotel.id) {
      return json({ ok: false, error: 'template_not_found' }, 404);
    }
    if (tpl.is_archived) {
      return json({ ok: false, error: 'template_archived' }, 400);
    }
    titleI18n = tpl.title_i18n;
    bodyI18n = tpl.body_i18n;
    ctaLabelI18n = tpl.cta_label_i18n ?? null;
    ctaUrl = tpl.cta_url ?? null;
    heroUrl = tpl.hero_image_url ?? null;
  } else {
    // ── Ad-hoc Campaign ───────────────────────────────────────────────────
    const title = body.title_default?.toString().trim();
    const bodyHtml = body.body_default_html?.toString() ?? '';
    if (!title || !bodyHtml.trim()) {
      return json({ ok: false, error: 'missing_template_or_content' }, 400);
    }

    const validation = validateVariables(`${title} ${bodyHtml}`);
    if (!validation.ok) {
      return json({
        ok: false, error: 'invalid_variables',
        unknown: validation.unknownVariables,
        forbidden: validation.forbiddenVariables,
      }, 400);
    }
    const sanitizedBody = sanitizeMarketingHtml(bodyHtml);
    const ctaLabel = body.cta_label_default?.toString().trim() || '';

    const [tRes, bRes, cRes] = await Promise.all([
      mergeAndTranslateMarketing(null, title, hotelDefault, { logLabel: 'marketing_campaigns.title' }),
      mergeAndTranslateMarketing(null, sanitizedBody, hotelDefault, { logLabel: 'marketing_campaigns.body' }),
      ctaLabel
        ? mergeAndTranslateMarketing(null, ctaLabel, hotelDefault, { logLabel: 'marketing_campaigns.cta' })
        : Promise.resolve(null),
    ]);
    const totalUSD = tRes.cost.estimatedUSD + bRes.cost.estimatedUSD + (cRes?.cost.estimatedUSD ?? 0);
    console.info(`[marketing/campaigns/create] auto-translate cost: $${totalUSD.toFixed(5)}`);

    titleI18n = tRes.i18n;
    bodyI18n = bRes.i18n;
    ctaLabelI18n = cRes ? cRes.i18n : null;
    ctaUrl = body.cta_url?.toString().trim() || null;
    heroUrl = body.hero_image_url?.toString().trim() || null;
  }

  // Scheduling: wenn scheduled_at gesetzt + in der Zukunft → status=scheduled
  let status: 'draft' | 'scheduled' = 'draft';
  let scheduledAt: string | null = null;
  if (body.scheduled_at) {
    const t = Date.parse(body.scheduled_at);
    if (!Number.isFinite(t)) return json({ ok: false, error: 'invalid_scheduled_at' }, 400);
    if (t <= Date.now() + 60_000) {
      return json({ ok: false, error: 'scheduled_at_must_be_future', hint: 'Mindestens 1 Minute in der Zukunft.' }, 400);
    }
    scheduledAt = new Date(t).toISOString();
    status = 'scheduled';
  }

  // Target-Filter validieren
  const targetFilter: any = {};
  if (body.target_filter?.language) targetFilter.language = body.target_filter.language;
  if (typeof body.target_filter?.min_visit_count === 'number' && body.target_filter.min_visit_count > 0) {
    targetFilter.min_visit_count = body.target_filter.min_visit_count;
  }

  const { data, error } = await sb.from('marketing_campaigns').insert({
    hotel_id: hotel.id,
    template_id: body.template_id ?? null,
    name,
    channels,
    title_i18n: titleI18n,
    body_i18n: bodyI18n,
    cta_label_i18n: ctaLabelI18n,
    cta_url: ctaUrl,
    hero_image_url: heroUrl,
    target_filter: Object.keys(targetFilter).length > 0 ? targetFilter : null,
    scheduled_at: scheduledAt,
    status,
    created_by: user.id,
  }).select('id').single();

  if (error) {
    console.error('[marketing/campaigns/create] insert failed:', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true, id: data!.id, status });
};
