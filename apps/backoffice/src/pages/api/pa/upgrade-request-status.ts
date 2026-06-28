import type { APIRoute } from 'astro';
import { getUser, isPlatformAdmin, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const VALID_STATUSES = new Set(['neu', 'kontaktiert', 'abgeschlossen', 'abgebrochen']);

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ error: 'Nicht eingeloggt' }, 401);

  const isAdmin = await isPlatformAdmin(cookies, request);
  if (!isAdmin) return json({ error: 'Nicht autorisiert' }, 403);

  let body: { id?: unknown; status?: unknown };
  try { body = await request.json(); } catch { return json({ error: 'Ungültiges JSON' }, 400); }

  const id     = body.id     ? String(body.id)     : null;
  const status = body.status ? String(body.status) : null;

  if (!id) return json({ error: 'id fehlt' }, 400);
  if (!status || !VALID_STATUSES.has(status)) return json({ error: 'Ungültiger Status' }, 400);

  const db = createSupabaseServiceRoleInstance();
  const { error } = await db
    .from('upgrade_requests')
    .update({ status })
    .eq('id', id);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
};
