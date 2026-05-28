// POST /api/admin/mews/sync
//
// Triggert syncHotelFromMews für das Hotel des eingeloggten Hoteliers.
// Body (optional): { windowDays?: number; useEnvCredentials?: boolean }
// Response 200:    { ok: true, rooms, reservations, guests, skipped*, durationMs }
// Response 4xx:    { ok: false, error: string }

import type { APIRoute } from 'astro';
import { getUser, getUserHotels } from '../../../../lib/auth';
import { syncHotelFromMews } from '../../../../lib/mews';

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) {
    return jsonResponse({ ok: false, error: 'Not authenticated' }, 401);
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) {
    return jsonResponse({ ok: false, error: 'No hotel for user' }, 403);
  }

  let body: { windowDays?: number; useEnvCredentials?: boolean } = {};
  try {
    if (request.headers.get('content-length') !== '0') {
      body = await request.json();
    }
  } catch {
    // Empty body or invalid JSON → use defaults
  }

  try {
    const result = await syncHotelFromMews(hotel.id, {
      windowDays: typeof body.windowDays === 'number' ? body.windowDays : undefined,
      useEnvCredentials: body.useEnvCredentials === true,
    });
    return jsonResponse({ ok: true, ...result }, 200);
  } catch (err) {
    console.error('[api/admin/mews/sync] failed:', err);
    return jsonResponse({ ok: false, error: (err as Error).message }, 500);
  }
};

function jsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
