import type { APIRoute } from 'astro';
import { getStaySession } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies }) => {
  const session = await getStaySession(cookies);
  if (!session) return json({ ok: false, error: 'no_stay_session' }, 401);
  // Showcase: no persistent cookie, but return ok so the gate reloads without error
  if (session.is_showcase) return json({ ok: true });

  cookies.set('gate_skip', 'true', {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    // No maxAge → session cookie, cleared when browser tab/session closes
  });
  return json({ ok: true });
};
