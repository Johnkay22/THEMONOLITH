import "server-only";

import type Stripe from "stripe";

async function handleSoloAcquisition(_paymentIntent: Stripe.PaymentIntent) {
  // TODO: Write solo acquisition settlement flow:
  // 1) deactivate active monolith row
  // 2) insert replacement row with valuation=payment amount
  // 3) archive prior occupant in history
}

async function handleSyndicateContribution(_paymentIntent: Stripe.PaymentIntent) {
  // TODO: Write syndicate settlement flow:
  // 1) insert contribution row
  // 2) increment syndicate total
  // 3) check coup condition against active monolith valuation
  // 4) activate syndicate text if threshold is crossed
}

export async function processSuccessfulPaymentIntent(
  paymentIntent: Stripe.PaymentIntent,
) {
  const mode = paymentIntent.metadata.mode;
  if (mode === "solo") {
    await handleSoloAcquisition(paymentIntent);
    return;
  }

  if (mode === "syndicate") {
    await handleSyndicateContribution(paymentIntent);
  }
}
