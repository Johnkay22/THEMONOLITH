import { NextResponse } from "next/server";
import { getStripeServerClient } from "@/lib/stripe";

type CheckoutMode = "solo" | "syndicate";

type CreatePaymentIntentPayload = {
  amount: number;
  mode: CheckoutMode;
  syndicateId?: string;
  proposedContent?: string;
};

function isCheckoutMode(value: unknown): value is CheckoutMode {
  return value === "solo" || value === "syndicate";
}

export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripe = getStripeServerClient();
  if (!stripe) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 500 },
    );
  }

  let payload: CreatePaymentIntentPayload;
  try {
    payload = (await request.json()) as CreatePaymentIntentPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  if (
    typeof payload.amount !== "number" ||
    Number.isNaN(payload.amount) ||
    payload.amount < 1
  ) {
    return NextResponse.json(
      { error: "Amount must be at least $1.00." },
      { status: 400 },
    );
  }

  if (!isCheckoutMode(payload.mode)) {
    return NextResponse.json(
      { error: "mode must be either 'solo' or 'syndicate'." },
      { status: 400 },
    );
  }

  const amountInCents = Math.round(payload.amount * 100);
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    metadata: {
      mode: payload.mode,
      syndicate_id: payload.syndicateId ?? "",
      proposed_content: payload.proposedContent ?? "",
    },
  });

  return NextResponse.json({
    clientSecret: paymentIntent.client_secret,
    paymentIntentId: paymentIntent.id,
  });
}
