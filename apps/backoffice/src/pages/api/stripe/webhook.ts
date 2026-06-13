import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import {
  getStripe,
  PRICE_TO_PLAN,
  isPlanEntry,
  isAddonEntry,
} from '../../../lib/stripe/config';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';

// ── Idempotenz ─────────────────────────────────────────────────────────────────
// Alle DB-Writes sind SET-Operationen (kein APPEND/INCREMENT).
// Dasselbe Event zweimal zu verarbeiten ändert nichts — kein separates
// Dedup-Log nötig. Stripe-Retries bei 4xx-Fehlern unsererseits sind ausgeschlossen,
// weil wir nach erfolgreicher Signaturprüfung immer 200 zurückgeben.

// ── Plan aus Subscription-Items ableiten ───────────────────────────────────────
function derivePlan(
  subscription: Stripe.Subscription,
): { plan: string; addons: string[] } | null {
  let plan: string | null = null;
  const addons: string[] = [];

  for (const item of subscription.items.data) {
    const priceId = item.price.id;
    const entry = PRICE_TO_PLAN[priceId];
    if (!entry) {
      console.warn('[stripe/webhook] Unbekannte Price-ID:', priceId);
      continue;
    }
    if (isPlanEntry(entry)) {
      plan = entry.plan;
    } else if (isAddonEntry(entry)) {
      addons.push(entry.addon);
    }
  }

  if (plan === null) {
    // Kein bekannter Plan gefunden → kein Update, Fehler nach oben melden
    return null;
  }
  return { plan, addons };
}

// ── checkout.session.completed ─────────────────────────────────────────────────
async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const hotelId = session.metadata?.hotel_id;
  if (!hotelId) {
    console.error('[stripe/webhook] checkout.session.completed ohne hotel_id', session.id);
    return;
  }

  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : null;
  if (!subscriptionId) {
    console.error('[stripe/webhook] checkout.session.completed ohne subscription', session.id);
    return;
  }

  const customerId =
    typeof session.customer === 'string' ? session.customer : null;

  // Subscription holen um Price-IDs zu kennen
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);

  const planData = derivePlan(subscription);
  if (!planData) {
    console.error(
      '[stripe/webhook] checkout.completed: kein bekannter Plan in subscription',
      subscriptionId,
      subscription.items.data.map(i => i.price.id),
    );
    return;
  }
  const { plan, addons } = planData;

  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan,
      addons,
      subscription_status: subscription.status,
    })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(
    `[stripe/webhook] checkout.completed → hotel=${hotelId} plan=${plan} addons=[${addons}] status=${subscription.status}`,
  );
}

// ── customer.subscription.updated ─────────────────────────────────────────────
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
): Promise<void> {
  const hotelId = subscription.metadata?.hotel_id;
  if (!hotelId) {
    console.error('[stripe/webhook] subscription.updated ohne hotel_id', subscription.id);
    return;
  }

  const planData = derivePlan(subscription);
  if (!planData) {
    console.error(
      '[stripe/webhook] subscription.updated: kein bekannter Plan',
      subscription.id,
      subscription.items.data.map(i => i.price.id),
    );
    return;
  }
  const { plan, addons } = planData;

  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({
      plan,
      addons,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(
    `[stripe/webhook] subscription.updated → hotel=${hotelId} plan=${plan} status=${subscription.status}`,
  );
}

// ── customer.subscription.deleted ─────────────────────────────────────────────
// Phase 6 übernimmt den vollständigen Downgrade-Pfad + DSGVO Grace Period.
// Hier: nur status=canceled setzen, damit die UI entsprechend reagiert.
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const hotelId = subscription.metadata?.hotel_id;
  if (!hotelId) {
    console.error('[stripe/webhook] subscription.deleted ohne hotel_id', subscription.id);
    return;
  }

  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({ subscription_status: 'canceled' })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(`[stripe/webhook] subscription.deleted → hotel=${hotelId} status=canceled`);
}

// ── invoice.payment_failed ─────────────────────────────────────────────────────
async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : typeof invoice.subscription === 'object' && invoice.subscription !== null
        ? invoice.subscription.id
        : null;

  if (!subscriptionId) {
    console.error('[stripe/webhook] invoice.payment_failed ohne subscription', invoice.id);
    return;
  }

  // Lookup via stripe_subscription_id — wurde von checkout.session.completed gesetzt
  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  if (error) {
    throw new Error(
      `hotel update fehlgeschlagen (subscription=${subscriptionId}): ${error.message}`,
    );
  }
  console.log(
    `[stripe/webhook] invoice.payment_failed → subscription=${subscriptionId} status=past_due`,
  );
}

// ── POST /api/stripe/webhook ───────────────────────────────────────────────────
export const POST: APIRoute = async ({ request }) => {
  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing stripe-signature', { status: 400 });
  }

  const webhookSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[stripe/webhook] STRIPE_WEBHOOK_SECRET nicht gesetzt');
    return new Response('Webhook not configured', { status: 500 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return new Response('Body unlesbar', { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe/webhook] Signaturprüfung fehlgeschlagen', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Nach erfolgreicher Signaturprüfung: immer 200 zurückgeben.
  // Verarbeitungsfehler werden geloggt, aber kein Retry getriggert —
  // Updates sind idempotent, manuelle Re-Trigger über Stripe Dashboard möglich.
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  } catch (err) {
    console.error(
      `[stripe/webhook] Verarbeitung von ${event.type} (${event.id}) fehlgeschlagen`,
      err,
    );
  }

  return new Response('OK', { status: 200 });
};
