import type { APIRoute } from 'astro';
import { getUser } from '../../lib/auth';

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';

const LANG_MAP: Record<string, string> = {
  en: 'EN-US',
  fr: 'FR',
  es: 'ES',
};

interface TranslateRequest {
  source: string;          // 'de' — we only translate FROM German
  targets: string[];       // ['en', 'fr', 'es']
  fields: Record<string, string>;  // { title_de: 'Tisch im Garten', sub_de: '...' }
}

export const POST: APIRoute = async ({ request, cookies }) => {
  // Auth check: only logged-in users can call this
  const user = await getUser(cookies, request);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const deeplKey = import.meta.env.DEEPL_API_KEY;
  if (!deeplKey) {
    return new Response(JSON.stringify({ ok: false, error: 'DeepL not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: TranslateRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body.source !== 'de') {
    return new Response(JSON.stringify({ ok: false, error: 'Only DE as source supported' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Gather all DE texts to translate
  const fieldNames = Object.keys(body.fields).filter(k => k.endsWith('_de'));
  const texts = fieldNames.map(k => body.fields[k] || '');

  // Skip if all empty
  if (texts.every(t => !t.trim())) {
    return new Response(JSON.stringify({ ok: false, error: 'Keine Texte zum Übersetzen' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result: Record<string, Record<string, string>> = {};

  // Make one DeepL call per target language
  for (const target of body.targets) {
    const targetLang = LANG_MAP[target];
    if (!targetLang) continue;

    try {
      const params = new URLSearchParams();
      params.set('source_lang', 'DE');
      params.set('target_lang', targetLang);
      // Formality only works for languages with T/V distinction
      // (DE has 'du/Sie', FR has 'tu/vous', ES has 'tú/usted', NL has 'je/u', etc.)
      // EN doesn't distinguish, so DeepL rejects formality there.
      const SUPPORTS_FORMALITY = new Set([
        'DE', 'FR', 'IT', 'ES', 'NL', 'PL', 'PT-BR', 'PT-PT', 'JA', 'RU',
      ]);
      if (SUPPORTS_FORMALITY.has(targetLang)) {
        params.set('formality', 'less');
      }
      params.set('preserve_formatting', '1');
      texts.forEach(t => params.append('text', t || ' '));  // empty placeholder if blank

      const deeplResp = await fetch(DEEPL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `DeepL-Auth-Key ${deeplKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!deeplResp.ok) {
        const errText = await deeplResp.text();
        console.error('DeepL error:', deeplResp.status, errText);
        return new Response(JSON.stringify({
          ok: false,
          error: `DeepL: ${deeplResp.status} ${errText.substring(0, 200)}`
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const data = await deeplResp.json();
      const translations = data.translations || [];

      // Map back to field names: title_de → title, etc.
      const langResult: Record<string, string> = {};
      fieldNames.forEach((fieldName, i) => {
        const baseField = fieldName.replace(/_de$/, '');
        langResult[baseField] = translations[i]?.text || '';
      });

      result[target] = langResult;
    } catch (e) {
      console.error('Translate error:', e);
      return new Response(JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
