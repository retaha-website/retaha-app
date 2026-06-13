import type { APIRoute } from 'astro';
import { getUser, getUserHotels } from '@retaha/auth';
import {
  getStripe,
  getPriceId,
  getEveAddonPriceId,
  type StripePlanKey,
  type BillingInterval,
} from '../../../lib/stripe/config';

const VALID_PLANS = new Set<string>(['lite', 'pro', 'premium']);
const VALID_INTERVALS = new Set<string>(['monthly', 'yearly']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ cookies, request }) => {
  const user = await getUser(cookies, request);
  if (!user) return json({ error: 'Nicht eingeloggt' }, 401);

  const hotels = await getUserHotels(cookies, request);
  const hotel = hotels?.[0]?.hotel;
  if (!hotel) return json({ error: 'Kein Hotel gefunden' }, 401);

  let body: { plan?: unknown; addon?: unknown; interval?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültiges JSON' }, 400);
  }

  let priceId: string;

  if (body.addon === 'eve') {
    const currentPlan: string = (hotel as any).plan ?? 'lite';
    if (currentPlan !== 'lite' && currentPlan !== 'pro') {
      return json({ error: 'Eve-Add-on ist nur für Lite- und Pro-Hotels buchbar' }, 400);
    }
    priceId = getEveAddonPriceId();
  } else if (body.plan != null && body.interval != null) {
    const plan = String(body.plan);
    const interval = String(body.interval);

    if (!VALID_PLANS.has(plan)) {
      return json({ error: `Ungültiger Plan: ${plan}` }, 400);
    }
    if (!VALID_INTERVALS.has(interval)) {
      return json({ error: `Ungültiges Intervall: ${interval}` }, 400);
    }

    // Prevent purchasing the current plan
    const currentPlan: string = (hotel as any).plan ?? 'lite';
    if (plan === currentPlan) {
      return json({ error: 'Das ist bereits dein aktueller Plan' }, 400);
    }

    priceId = getPriceId(plan as StripePlanKey, interval as BillingInterval);
  } else {
    return json({ error: 'plan + interval oder addon erforderlich' }, 400);
  }

  const origin = new URL(request.url).origin;
  const stripe = getStripe();

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: `${origin}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/subscription`,
      metadata: {
        hotel_id: hotel.id,
      },
      subscription_data: {
        metadata: { hotel_id: hotel.id },
      },
      locale: 'de',
    });
  } catch (err: unknown) {
    console.error('[stripe/checkout] session.create failed', err);
    const message = err instanceof Error ? err.message : 'Stripe-Fehler';
    return json({ error: message }, 500);
  }

  if (!session.url) {
    return json({ error: 'Stripe gab keine Checkout-URL zurück' }, 500);
  }

  return json({ url: session.url });
};
