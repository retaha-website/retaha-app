// Sprint Functional Modul B Phase 5 — Setup-Wizard Save-Endpoint
//
// POST /api/admin/setup/save-step
// Body: { step: 'hotel_basics'|'address'|'languages'|'mews', data: {...} }
//
// Schreibt die Wizard-Daten in die echten Tabellen (hotels, hotel_settings)
// + setzt step_* in onboarding_state. Idempotent — Wizard kann unterbrochen
// und fortgesetzt werden.

import type { APIRoute } from 'astro';
import { getUserHotels } from '@retaha/auth';
import { requirePermission } from '@retaha/auth';
import { markStep } from '../../../../lib/onboarding/checklist';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

const VALID_LANGS = ['de','en','fr','es','it','pt','nl','ru','ar','zh'];

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'no_hotel' }, 403);

  const auth = await requirePermission(cookies, request, hotel.id, 'settings.write');
  if (auth instanceof Response) return auth;

  let body: { step?: string; data?: any };
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'invalid_json' }, 400); }

  const admin = createSupabaseServiceRoleInstance();
  const data = body.data ?? {};

  switch (body.step) {
    case 'hotel_basics': {
      const name = String(data.name ?? '').trim();
      if (!name) return json({ ok: false, error: 'name_required' }, 400);
      await admin.from('hotels').update({ name }).eq('id', hotel.id);
      await markStep(admin, hotel.id, 'hotel_basics');
      return json({ ok: true });
    }
    case 'languages': {
      const def = String(data.default_language ?? 'de');
      const enabled = Array.isArray(data.enabled_languages) ? data.enabled_languages : ['de','en','fr','es'];
      if (!VALID_LANGS.includes(def)) return json({ ok: false, error: 'invalid_default_language' }, 400);
      if (!enabled.includes(def) || enabled.length === 0 || enabled.length > 6) {
        return json({ ok: false, error: 'invalid_enabled_languages' }, 400);
      }
      await admin.from('hotels').update({ default_language: def, enabled_languages: enabled }).eq('id', hotel.id);
      await markStep(admin, hotel.id, 'languages');
      return json({ ok: true });
    }
    case 'address': {
      const street = String(data.street ?? '').trim() || null;
      const zip = String(data.zip ?? '').trim() || null;
      const city = String(data.city ?? '').trim() || null;
      const country = String(data.country ?? '').trim() || 'Deutschland';
      const update: Record<string, any> = { address_street: street, address_zip: zip, city, country };

      // Geocoding (analog /admin/settings update_address Handler)
      if (street && city) {
        try {
          const { geocodeAddress, buildAddressQuery } = await import('../../../../lib/places/geocoding');
          const q = buildAddressQuery({ street, zip, city, country });
          if (q.length >= 5) {
            const result = await geocodeAddress(q);
            if (result) {
              update.latitude = result.lat;
              update.longitude = result.lng;
            }
          }
        } catch (_) { /* non-fatal */ }
      }

      await admin.from('hotels').update(update).eq('id', hotel.id);
      await markStep(admin, hotel.id, 'address');
      return json({ ok: true, geocoded: typeof update.latitude === 'number' });
    }
    case 'mews_skip': {
      await markStep(admin, hotel.id, 'mews');
      return json({ ok: true, skipped: true });
    }
    case 'complete': {
      // Vom Schritt 5 (Done) → completed_at setzen
      const now = new Date().toISOString();
      await admin.from('onboarding_state').upsert({
        hotel_id: hotel.id,
        completed_at: now,
      }, { onConflict: 'hotel_id' });

      // Seed default FAQ if eve_knowledge is still empty for this hotel
      const { count } = await admin
        .from('eve_knowledge')
        .select('id', { count: 'exact', head: true })
        .eq('hotel_id', hotel.id);
      if ((count ?? 0) === 0) {
        const { data: hotelData } = await admin
          .from('hotels').select('default_language').eq('id', hotel.id).maybeSingle();
        const lang = (hotelData?.default_language as string) ?? 'de';
        await admin.from('eve_knowledge').insert({
          hotel_id: hotel.id,
          category: 'faq',
          language_code: lang,
          is_published: true,
          sort_order: 1,
          question: 'Wann ist Check-out?',
          answer: 'Check-out ist täglich bis 11:00 Uhr. Ein späterer Check-out ist oft möglich — frag mich gerne.',
          question_i18n: {
            de: { value: 'Wann ist Check-out?',          source: 'original', updated_at: now },
            en: { value: 'What time is check-out?',       source: 'auto',     updated_at: now },
            fr: { value: 'À quelle heure est le départ ?',source: 'auto',     updated_at: now },
            es: { value: '¿A qué hora es la salida?',     source: 'auto',     updated_at: now },
            it: { value: 'A che ora è il check-out?',     source: 'auto',     updated_at: now },
            nl: { value: 'Hoe laat is het uitchecken?',   source: 'auto',     updated_at: now },
          },
          answer_i18n: {
            de: { value: 'Check-out ist täglich bis 11:00 Uhr. Ein späterer Check-out ist oft möglich — frag mich gerne.',           source: 'original', updated_at: now },
            en: { value: 'Check-out is daily until 11:00. A late check-out is often possible — just ask me.',                         source: 'auto',     updated_at: now },
            fr: { value: "Le départ est chaque jour jusqu'à 11h00. Un départ tardif est souvent possible — demandez-moi.",            source: 'auto',     updated_at: now },
            es: { value: 'La salida es a diario hasta las 11:00. Una salida tardía suele ser posible — no dude en preguntarme.',      source: 'auto',     updated_at: now },
            it: { value: 'Il check-out è tutti i giorni entro le 11:00. Un check-out posticipato è spesso possibile — chiedimi pure.',source: 'auto',     updated_at: now },
            nl: { value: 'Uitchecken kan dagelijks tot 11:00 uur. Later uitchecken is vaak mogelijk — vraag het me gerust.',           source: 'auto',     updated_at: now },
          },
        });
      }

      return json({ ok: true });
    }
    default:
      return json({ ok: false, error: 'unknown_step' }, 400);
  }
};
