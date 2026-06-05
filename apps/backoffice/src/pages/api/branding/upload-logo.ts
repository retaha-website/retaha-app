import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';

const VALID_KEYS = ['logo_primary', 'logo_icon', 'logo_wordmark', 'logo_dark', 'logo_print',
                    'splash_background', 'wallet_pass_bg', 'email_header'] as const;
type AssetKey = typeof VALID_KEYS[number];

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return new Response(JSON.stringify({ error: 'Nicht angemeldet' }), { status: 401 });

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return new Response(JSON.stringify({ error: 'Kein Hotel' }), { status: 403 });

  const form = await request.formData();
  const key = form.get('key')?.toString() as AssetKey | undefined;
  const file = form.get('file') as File | null;
  const deleteFlag = form.get('delete') === 'true';

  if (!key || !VALID_KEYS.includes(key)) {
    return new Response(JSON.stringify({ error: 'Ungültiger key' }), { status: 400 });
  }

  // User-Client für hotels-Tabelle, Service-Role für Storage (umgeht RLS)
  const client        = createSupabaseServerInstance(cookies, request);
  const serviceClient = createSupabaseServiceRoleInstance();

  // DELETE
  if (deleteFlag) {
    const { error } = await client.from('hotels').update({ [key]: null }).eq('id', hotel.id);
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    return new Response(JSON.stringify({ url: null }), { status: 200 });
  }

  // UPLOAD
  if (!file || file.size === 0) {
    return new Response(JSON.stringify({ error: 'Keine Datei' }), { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return new Response(JSON.stringify({ error: 'Datei zu groß (max. 5 MB)' }), { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const filename = `${hotel.id}/${key}-${Date.now()}.${ext}`;

  const { error: uploadError } = await serviceClient.storage
    .from('branding-assets')
    .upload(filename, file, { cacheControl: '31536000', upsert: true });

  if (uploadError) {
    return new Response(JSON.stringify({ error: uploadError.message }), { status: 500 });
  }

  const { data: { publicUrl } } = serviceClient.storage
    .from('branding-assets')
    .getPublicUrl(filename);

  const { error: updateError } = await client
    .from('hotels')
    .update({ [key]: publicUrl })
    .eq('id', hotel.id);

  if (updateError) {
    return new Response(JSON.stringify({ error: updateError.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ url: publicUrl }), { status: 200 });
};
