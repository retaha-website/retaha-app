// POST /api/marketing/upload-asset
// Lädt ein Bild in den Supabase-Storage-Bucket "marketing-assets" hoch.
// Gibt { ok: true, url: "https://…" } zurück.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = await getUser(cookies, request);
  if (!user) return resp({ ok: false, error: 'Unauthorized' }, 401);
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return resp({ ok: false, error: 'no_hotel' }, 400);

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return resp({ ok: false, error: 'invalid_form' }, 400); }

  const file = formData.get('file') as File | null;
  if (!file || typeof file === 'string') return resp({ ok: false, error: 'no_file' }, 400);

  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!ALLOWED.includes(file.type)) return resp({ ok: false, error: 'invalid_type' }, 400);
  if (file.size > 5 * 1024 * 1024) return resp({ ok: false, error: 'file_too_large' }, 400);

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const safeExt = ALLOWED.some(m => m.endsWith(ext)) ? ext : 'jpg';
  const filename = `${hotel.id}/${Date.now()}.${safeExt}`;

  const supabase = createSupabaseServiceRoleInstance();
  const buf = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from('marketing-assets')
    .upload(filename, buf, { contentType: file.type, upsert: false });

  if (error) return resp({ ok: false, error: error.message }, 500);

  const { data: { publicUrl } } = supabase.storage
    .from('marketing-assets')
    .getPublicUrl(filename);

  return resp({ ok: true, url: publicUrl });
};

function resp(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
