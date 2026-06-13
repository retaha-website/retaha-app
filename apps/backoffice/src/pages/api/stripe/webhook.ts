import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import {
  getStripe,
  PRICE_TO_PLAN,
  isPlanEntry,
  isAddonEntry,
} from '../../../lib/stripe/config';
import { createSupabaseServiceRoleInstance } from '@retaha/auth';
import {
  computeLostModules,
  computeGainedModules,
  scheduleModuleDeletions,
} from '../../../lib/stripe/module-deletions';

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
    return null;
  }
  return { plan, addons };
}

// ── Aktuellen Plan des Hotels aus DB lesen ────────────────────────────────────
async function readCurrentHotelPlan(
  hotelId: string,
): Promise<{ plan: string; addons: string[] } | null> {
  const { data } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .select('plan, addons')
    .eq('id', hotelId)
    .maybeSingle();

  if (!data) return null;
  return {
    plan: (data as any).plan ?? 'lite',
    addons: (data as any).addons ?? [],
  };
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
  const { plan: newPlan, addons: newAddons } = planData;

  // Phase 6: Lösch-Fahrplan bei Downgrade / Reaktivierung
  const current = await readCurrentHotelPlan(hotelId);
  if (current) {
    const lost   = computeLostModules(current.plan, current.addons, newPlan, newAddons);
    const gained = computeGainedModules(current.plan, current.addons, newPlan, newAddons);
    if (lost.length > 0 || gained.length > 0) {
      await scheduleModuleDeletions({
        hotelId, lost, gained,
        trigger: 'checkout.session.completed',
        oldPlan: current.plan,
        newPlan,
      });
    }
  }

  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: newPlan,
      addons: newAddons,
      subscription_status: subscription.status,
    })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(
    `[stripe/webhook] checkout.completed → hotel=${hotelId} plan=${newPlan} addons=[${newAddons}] status=${subscription.status}`,
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
  const { plan: newPlan, addons: newAddons } = planData;

  // Phase 6: alten Plan VOR dem Update lesen → Downgrade/Upgrade erkennen
  const current = await readCurrentHotelPlan(hotelId);
  const oldPlan   = current?.plan   ?? 'lite';
  const oldAddons = current?.addons ?? [];

  const lost   = computeLostModules(oldPlan, oldAddons, newPlan, newAddons);
  const gained = computeGainedModules(oldPlan, oldAddons, newPlan, newAddons);

  if (lost.length > 0 || gained.length > 0) {
    await scheduleModuleDeletions({
      hotelId, lost, gained,
      trigger: 'subscription.updated',
      oldPlan,
      newPlan,
    });
  }

  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({
      plan: newPlan,
      addons: newAddons,
      subscription_status: subscription.status,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(
    `[stripe/webhook] subscription.updated → hotel=${hotelId} plan=${newPlan} status=${subscription.status}`,
  );
}

// ── customer.subscription.deleted ─────────────────────────────────────────────
// Phase 6: Plan sofort auf 'lite' setzen (blockiert Modul-Zugriff via isModuleAvailable),
// alle betroffenen Module in den 30-Tage-Lösch-Fahrplan.
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<void> {
  const hotelId = subscription.metadata?.hotel_id;
  if (!hotelId) {
    console.error('[stripe/webhook] subscription.deleted ohne hotel_id', subscription.id);
    return;
  }

  const current = await readCurrentHotelPlan(hotelId);
  const oldPlan   = current?.plan   ?? 'lite';
  const oldAddons = current?.addons ?? [];

  // Alle Module, die bei altem Plan verfügbar, bei 'lite' ohne Addons nicht mehr
  const lost = computeLostModules(oldPlan, oldAddons, 'lite', []);

  if (lost.length > 0) {
    await scheduleModuleDeletions({
      hotelId, lost, gained: [],
      trigger: 'subscription.deleted',
      oldPlan,
      newPlan: 'lite',
    });
  }

  // Plan sofort auf 'lite' — blockiert Modul-Zugriff, Daten bleiben noch 30d
  const { error } = await createSupabaseServiceRoleInstance()
    .from('hotels')
    .update({
      plan: 'lite',
      addons: [],
      subscription_status: 'canceled',
    })
    .eq('id', hotelId);

  if (error) throw new Error(`hotel update fehlgeschlagen (${hotelId}): ${error.message}`);
  console.log(
    `[stripe/webhook] subscription.deleted → hotel=${hotelId} plan=lite status=canceled lost=[${lost}]`,
  );
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
