/**
 * POST /api/account/avatar
 *
 * Profilfoto hochladen/ersetzen oder entfernen. User-Level (kein Hotel).
 * Speicherung: branding-assets-Bucket unter avatars/{user_id}/ (public, Upload
 * via Service-Role). URL landet in auth.users.user_metadata.avatar_url —
 * KEINE Tabellen-/RLS-Migration nötig.
 *
 * Body (multipart): file (Bild) ODER delete=true.
 */
import type { APIRoute } from 'astro';
import { getUser, createSupabaseServerInstance, createSupabaseServiceRoleInstance } from '@retaha/auth';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'branding-assets';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet' }, 401);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json({ error: 'Ungültige Eingabe' }, 400); }

  const client = createSupabaseServerInstance(cookies, request);

  // ── Entfernen ──
  if (form.get('delete') === 'true') {
    const { error } = await client.auth.updateUser({ data: { avatar_url: null } });
    if (error) return json({ error: error.message }, 500);
    return json({ url: null }, 200);
  }

  // ── Hochladen / Ersetzen ──
  const file = form.get('file') as File | null;
  if (!file || file.size === 0) return json({ error: 'Keine Datei' }, 400);
  if (!file.type.startsWith('image/')) return json({ error: 'Nur Bilddateien erlaubt' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'Datei zu groß (max. 5 MB)' }, 400);

  const ext = (file.name.split('.').pop()?.toLowerCase() || 'png').replace(/[^a-z0-9]/g, '') || 'png';
  const path = `avatars/${user.id}/avatar-${Date.now()}.${ext}`;

  const service = createSupabaseServiceRoleInstance();
  const { error: upErr } = await service.storage
    .from(BUCKET)
    .upload(path, file, { cacheControl: '31536000', upsert: true, contentType: file.type });
  if (upErr) return json({ error: upErr.message }, 500);

  const { data: { publicUrl } } = service.storage.from(BUCKET).getPublicUrl(path);

  const { error: updErr } = await client.auth.updateUser({ data: { avatar_url: publicUrl } });
  if (updErr) return json({ error: updErr.message }, 500);

  return json({ url: publicUrl }, 200);
};
