/**
 * POST /api/mfa/send-reminder
 *
 * Hotel-Owner triggert MFA-Erinnerung an Team-Mitglieder die noch kein MFA haben.
 *
 * Body: { hotelId: string }
 *
 * Auth: Owner-only.
 *
 * Sprint-J-Backlog: Email-Versand via Resend mit mfa-team-reminder.tsx Template.
 * Aktueller Stub: Logged Audit + Returns count.
 */

import type { APIRoute } from 'astro';
import {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  getUserHotels,
} from '@retaha/auth';
import { logMfaEvent, parseUaFamily, parseDevice } from '@retaha/auth/mfa';

export const POST: APIRoute = async ({ request, cookies }) => {
  let hotelId: string;
  try {
    const body = await request.json();
    hotelId = body.hotelId;
  } catch {
    return bad('invalid-body', 'ungueltige eingabe');
  }

  if (!hotelId) return bad('missing-hotel', 'hotel-id erforderlich');

  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const hotels = await getUserHotels(supabase, userRes.user.id);
  const isOwner = hotels.some(
    (h: { id: string; role?: string }) => h.id === hotelId && h.role === 'owner',
  );
  if (!isOwner) {
    return new Response(
      JSON.stringify({ ok: false, error: 'not-owner' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const service = createSupabaseServiceRoleInstance();

  // Hole alle hotel_users mit (user_mfa.enabled IS NULL OR enabled = false)
  const { data: pendingUsers } = await service
    .from('hotel_users')
    .select('user_id, users:user_id(email)')
    .eq('hotel_id', hotelId);

  // Filter: nur die ohne MFA
  const userIds = (pendingUsers ?? []).map((u: { user_id: string }) => u.user_id);
  const { data: mfas } = await service
    .from('user_mfa')
    .select('user_id, enabled')
    .in('user_id', userIds);

  const enabledSet = new Set(
    (mfas ?? []).filter((m: { enabled: boolean }) => m.enabled).map((m: { user_id: string }) => m.user_id),
  );
  const pendingCount = userIds.filter((id: string) => !enabledSet.has(id)).length;

  // TODO Sprint-J: hier Email-Versand via Resend
  // Aktuell nur Audit-Log
  const ua = request.headers.get('user-agent');
  await logMfaEvent(service, {
    userId: userRes.user.id,
    hotelId,
    eventType: 'team_policy_changed',
    metadata: {
      ua_family: parseUaFamily(ua),
      device: parseDevice(ua),
      context: { action: 'reminder_sent', pending_count: pendingCount },
    },
  });

  return new Response(
    JSON.stringify({ ok: true, pending_count: pendingCount, emails_sent: 0, note: 'Email-Versand kommt in Sprint-J' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};

function bad(code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status: 400, headers: { 'Content-Type': 'application/json' },
  });
}
