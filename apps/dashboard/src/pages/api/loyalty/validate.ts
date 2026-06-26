import type { APIRoute } from 'astro';
import { getUser, getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';
import { lookupVoucher, validateVoucher } from '@retaha/loyalty';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  let body: { code?: string; action?: string };
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid_json' }, 400); }
  const code = String(body.code ?? '').trim();
  if (!code) return json({ ok: false, error: 'missing_code' }, 400);

  const sb = createSupabaseServiceRoleInstance();

  if (body.action === 'redeem') {
    let validatedBy: string | null = null;
    try { validatedBy = (await getUser(cookies, request))?.id ?? null; } catch { /* optional */ }
    const result = await validateVoucher(sb, { hotelId: hotel.id, code, validatedBy });
    return json(result, result.ok ? 200 : 400);
  }

  const voucher = await lookupVoucher(sb, hotel.id, code);
  if (!voucher) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, voucher });
};
