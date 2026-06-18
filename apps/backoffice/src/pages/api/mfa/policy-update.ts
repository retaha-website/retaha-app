/**
 * POST /api/mfa/policy/update
 *
 * Updated User- und Hotel-MFA-Policies (Owner-only fuer team_required).
 *
 * Body: { setting: 'personal'|'magic_link'|'team_required', value: boolean, hotelId?: string }
 *
 * Auth:
 *   - personal: jeder authenticated user (eigenes mfa)
 *   - magic_link: jeder authenticated user (eigenes mfa)
 *   - team_required: NUR Hotel-Owner (role-check)
 */

import type { APIRoute } from 'astro';
import {
  createSupabaseServerInstance,
  createSupabaseServiceRoleInstance,
  getUserHotels,
} from '@retaha/auth';
import { logMfaEvent, parseUaFamily, parseDevice } from '@retaha/auth/mfa';

type Setting = 'personal' | 'magic_link' | 'team_required';

export const POST: APIRoute = async ({ request, cookies }) => {
  let setting: Setting;
  let value: boolean;
  let hotelId: string | undefined;

  try {
    const body = await request.json();
    setting = body.setting as Setting;
    value = !!body.value;
    hotelId = body.hotelId;
  } catch {
    return bad('invalid-body', 'ungueltige eingabe');
  }

  if (!['personal', 'magic_link', 'team_required'].includes(setting)) {
    return bad('invalid-setting', 'unbekannte einstellung');
  }

  const supabase = createSupabaseServerInstance(cookies);
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const user = userRes.user;
  const service = createSupabaseServiceRoleInstance();
  const ua = request.headers.get('user-agent');
  const metadata = { ua_family: parseUaFamily(ua), device: parseDevice(ua) };

  // === SETTING: personal ===
  if (setting === 'personal') {
    // 'personal off' bedeutet: kompletter Disable inkl. recovery-codes loeschen
    if (value === false) {
      await service.from('user_mfa').update({ enabled: false }).eq('user_id', user.id);
      await service.from('user_mfa_recovery_codes').delete().eq('user_id', user.id);
      await logMfaEvent(service, { userId: user.id, eventType: 'disabled', metadata });
      return ok();
    }
    // 'personal on' kann nicht hier aktiviert werden — User muss durch Setup-Wizard
    return bad(
      'use-wizard',
      'aktivierung nur ueber setup-wizard moeglich (/profil#security)',
    );
  }

  // === SETTING: magic_link ===
  if (setting === 'magic_link') {
    // Voraussetzung: personal_mfa muss enabled sein
    const { data: mfa } = await service
      .from('user_mfa')
      .select('enabled')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!mfa?.enabled) {
      return bad('mfa-not-enabled', '2fa fuer das konto muss erst aktiviert sein');
    }
    await service
      .from('user_mfa')
      .update({ require_on_magic_link: value })
      .eq('user_id', user.id);
    return ok();
  }

  // === SETTING: team_required (Owner-only) ===
  if (setting === 'team_required') {
    if (!hotelId) {
      return bad('missing-hotel', 'hotel-id erforderlich');
    }
    // Owner-Check via getUserHotels (gibt Hotels zurueck wo User Owner ist)
    const hotels = await getUserHotels(supabase, user.id);
    const isOwner = hotels.some(
      (h: { id: string; role?: string }) => h.id === hotelId && h.role === 'owner',
    );
    if (!isOwner) {
      return new Response(
        JSON.stringify({ ok: false, error: 'not-owner', message: 'nur owner duerfen team-pflicht setzen' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }

    await service
      .from('hotels')
      .update({
        mfa_required_for_team: value,
        mfa_required_set_at: value ? new Date().toISOString() : null,
        mfa_required_set_by: value ? user.id : null,
      })
      .eq('id', hotelId);

    await logMfaEvent(service, {
      userId: user.id,
      eventType: 'team_policy_changed',
      hotelId,
      metadata: { ...metadata, context: { team_required: value } },
    });

    return ok();
  }

  return bad('unhandled', 'unbekannte einstellung');
};

function ok(extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: true, ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function bad(code: string, message: string): Response {
  return new Response(JSON.stringify({ ok: false, error: code, message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}
