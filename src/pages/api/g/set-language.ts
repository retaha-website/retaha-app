// Sprint i18n-Expansion Phase 7 — Gast-Sprach-Persistenz
//
// POST /api/g/set-language  body: { token, lang }
// Schreibt guests.language so dass beim nächsten Besuch derselben Stay-URL
// die zuletzt gewählte Sprache verwendet wird (vor dem Browser-Locale).
//
// Auth: über stay.access_token (kein User-Login nötig — Gast-Frontend).
// Validation: lang muss in hotels.enabled_languages des Hotels des Stays sein.

import type { APIRoute } from 'astro';
import { createSupabaseServiceRoleInstance } from '../../../lib/auth';
import { isLanguageCode } from '../../../lib/i18n/types.ts';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let body: { token?: string; lang?: string };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const token = body.token?.trim();
  const lang = body.lang?.trim();
  if (!token || !lang) return json({ ok: false, error: 'missing_fields' }, 400);
  if (!isLanguageCode(lang)) return json({ ok: false, error: 'invalid_language' }, 400);

  const sb = createSupabaseServiceRoleInstance();

  // Stay + Hotel laden, enabled_languages prüfen
  const { data: stay } = await sb
    .from('stays')
    .select('id, guest_id, hotel_id, hotels!inner(enabled_languages)')
    .eq('access_token', token)
    .maybeSingle();
  if (!stay) return json({ ok: false, error: 'stay_not_found' }, 404);

  const enabled = (stay as any).hotels?.enabled_languages ?? ['de','en','fr','es'];
  if (!enabled.includes(lang)) {
    return json({ ok: false, error: 'language_not_enabled' }, 400);
  }

  if (!stay.guest_id) {
    // Stay ohne Guest (z.B. Company-Account) → kein Persist möglich,
    // Frontend nutzt URL-Param dann als Quelle für nächste Visits
    return json({ ok: true, persisted: false, reason: 'no_guest_record' });
  }

  const { error } = await sb
    .from('guests')
    .update({ language: lang })
    .eq('id', stay.guest_id);
  if (error) return json({ ok: false, error: error.message }, 500);

  return json({ ok: true, persisted: true, lang });
};
