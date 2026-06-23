import type { APIRoute } from 'astro';
import { getUserHotels, createSupabaseServiceRoleInstance } from '@retaha/auth';

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Markiert die QR-/NFC-Bestell-Benachrichtigung als gelesen — pro Hotel/Account.
// Aufgerufen, wenn der Hotelier im Benachrichtigungs-Drawer auf den Shop-Link klickt.
export const POST: APIRoute = async ({ cookies, request }) => {
  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ ok: false, error: 'Unauthorized' }, 401);

  const supabase = createSupabaseServiceRoleInstance();
  const { error } = await supabase
    .from('hotels')
    .update({ qr_notif_pending: false })
    .eq('id', hotel.id);

  if (error) {
    console.error('[notifications/qr-clear]', error);
    return json({ ok: false, error: error.message }, 500);
  }
  return json({ ok: true });
};
