import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import { randomBytes } from 'node:crypto';

const SHOWCASE_PREFIX = 'showcase_';
const TTL_DAYS = 30;

function makeToken(): string {
  // 8 hex chars (4 bytes) — kurz genug für lesbare URLs, sicher genug für zeitlimitierte Sessions
  return SHOWCASE_PREFIX + randomBytes(4).toString('hex');
}

function buildGuestUrl(hotelSlug: string | null | undefined, token: string, isLite: boolean): string {
  const domain = import.meta.env.RETAHA_DOMAIN ?? 'retaha.de';
  if (!isLite && hotelSlug) {
    // Pro/Premium: Hotelname als Subdomain
    return `https://${hotelSlug}.${domain}/g/${token}`;
  }
  if (isLite && hotelSlug) {
    // Lite: kein Subdomain, aber Slug im Pfad → app.retaha.de/g/hotel-slug/token
    return `https://app.${domain}/g/${hotelSlug}/${token}`;
  }
  return `https://app.${domain}/g/${token}`;
}

export async function getOrCreateShowcaseUrl(
  hotelId: string,
  userId: string,
): Promise<string | null> {
  const sb = createSupabaseServiceRoleInstance();

  const [{ data: hotel }, { data: existing }] = await Promise.all([
    sb.from('hotels').select('slug, plan').eq('id', hotelId).single(),
    sb
      .from('showcase_sessions')
      .select('token')
      .eq('hotel_id', hotelId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const isLite = ((hotel as any)?.plan ?? 'lite') === 'lite';
  const slug = (hotel as any)?.slug ?? null;

  if (existing?.token) {
    return buildGuestUrl(slug, existing.token, isLite);
  }

  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000).toISOString();
  const { data: created, error } = await sb
    .from('showcase_sessions')
    .insert({
      hotel_id:   hotelId,
      token:      makeToken(),
      created_by: userId,
      expires_at: expiresAt,
      is_active:  true,
      demo_data: {
        guest_first_name: 'Max',
        guest_last_name:  'Mustergast',
        room_number:      '101',
        room_name:        'Deluxe Suite',
      },
    })
    .select('token')
    .single();

  if (error || !created?.token) return null;
  return buildGuestUrl(slug, created.token, isLite);
}
