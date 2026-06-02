// Sprint D · Phase 6a — Manueller Pre-Arrival-Trigger
//
// POST /api/admin/pre-arrival-trigger — Hotelier kann den Mail-Run von Hand
// auslösen (für Tests, oder wenn der letzte Mews-Sync den Trigger verpasst hat).
// Idempotent über stays.pre_arrival_sent_at — wiederholtes Aufrufen schickt
// keine Doppel-Mails.

import type { APIRoute } from 'astro';
import { getUser, getUserHotels } from '@retaha/auth';
import { sendPreArrivalInvitesForHotel } from '../../../lib/email/send-pre-arrival-invites';

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) {
    return new Response(JSON.stringify({ ok: false, error: 'No hotel for user' }), {
      status: 403, headers: { 'Content-Type': 'application/json' },
    });
  }

  const stats = await sendPreArrivalInvitesForHotel(hotel.id);
  return new Response(JSON.stringify({ ok: true, ...stats }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
