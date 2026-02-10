import "server-only";

import Stripe from "stripe";
import { env } from "@/lib/env";

let stripeClient: Stripe | null | undefined;

export function getStripeServerClient() {
  if (stripeClient !== undefined) {
    return stripeClient;
  }

  if (!env.STRIPE_SECRET_KEY) {
    stripeClient = null;
    return stripeClient;
  }

  stripeClient = new Stripe(env.STRIPE_SECRET_KEY);
  return stripeClient;
}
