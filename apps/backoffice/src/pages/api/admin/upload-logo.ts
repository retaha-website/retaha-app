// Sprint D · Phase 6e — Hotel-Logo-Upload
//
// Form-POST mit multipart/form-data von /admin/settings.
// File → Supabase Storage "hotel-logos"-Bucket → Public-URL in hotels.logo_url.
// Optional Body-Field _action="remove" löscht das Logo (Storage + DB).
//
// Auth: SSR-Session (User muss hotel_user dieses Hotels sein, RLS prüft beim
// hotel-lookup). Upload selbst via Service-Role (Storage-Schreibrechte).

import type { APIRoute } from 'astro';
import {
  getUser,
  getUserHotels,
  createSupabaseServiceRoleInstance,
} from '@retaha/auth';

const BUCKET = 'hotel-logos';
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];
const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
};

export const POST: APIRoute = async ({ cookies, request, redirect }) => {
  // Auth
  const user = await getUser(cookies, request);
  if (!user) return redirect('/admin/login', 303);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return redirect('/admin/login?error=no_hotel', 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirect('/admin/settings?logo_error=invalid_form', 303);
  }

  const admin = createSupabaseServiceRoleInstance();
  const action = form.get('_action')?.toString();

  // ── Remove ───────────────────────────────────────────────────────────
  if (action === 'remove') {
    // Bisherige URL holen + Pfad rekonstruieren falls möglich, dann Storage-File löschen.
    const { data: hotelRow } = await admin
      .from('hotels')
      .select('logo_url')
      .eq('id', hotel.id)
      .maybeSingle();

    if (hotelRow?.logo_url) {
      const prefix = `/storage/v1/object/public/${BUCKET}/`;
      const idx = hotelRow.logo_url.indexOf(prefix);
      if (idx >= 0) {
        const path = hotelRow.logo_url.slice(idx + prefix.length);
        await admin.storage.from(BUCKET).remove([path]);
      }
    }

    await admin.from('hotels').update({ logo_url: null }).eq('id', hotel.id);
    return redirect('/admin/settings?saved=logo_removed', 303);
  }

  // ── Upload ───────────────────────────────────────────────────────────
  const file = form.get('logo');
  if (!(file instanceof File) || file.size === 0) {
    return redirect('/admin/settings?logo_error=no_file', 303);
  }
  if (file.size > MAX_BYTES) {
    return redirect('/admin/settings?logo_error=too_large', 303);
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    return redirect('/admin/settings?logo_error=invalid_type', 303);
  }

  const ext = MIME_TO_EXT[file.type] ?? 'png';
  // Deterministischer Pfad pro Hotel (überschreibt vorherigen Upload, kein
  // Storage-Garbage durch Re-Uploads). Cache-Buster via Query-Param am Frontend.
  const path = `${hotel.id}/logo.${ext}`;

  const buffer = await file.arrayBuffer();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadErr) {
    console.error('[upload-logo] storage upload failed:', uploadErr);
    return redirect(`/admin/settings?logo_error=storage&detail=${encodeURIComponent(uploadErr.message)}`, 303);
  }

  // Public-URL bauen + speichern. Cache-Buster mit Timestamp.
  const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
  const finalUrl = `${pub.publicUrl}?v=${Date.now()}`;

  const { error: updateErr } = await admin
    .from('hotels')
    .update({ logo_url: finalUrl })
    .eq('id', hotel.id);

  if (updateErr) {
    console.error('[upload-logo] hotels.update failed:', updateErr);
    return redirect('/admin/settings?logo_error=db_save', 303);
  }

  console.info(`[upload-logo] hotel ${hotel.id} → ${path} (${(file.size / 1024).toFixed(1)} KB)`);
  return redirect('/admin/settings?saved=logo', 303);
};
