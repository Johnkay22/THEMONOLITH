import { NextResponse } from "next/server";
import {
  contributeToSyndicate,
  getLandingSnapshot,
  MonolithValidationError,
} from "@/lib/protocol/monolith";

type ContributePayload = {
  syndicateId: string;
  amount: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: ContributePayload;
  try {
    payload = (await request.json()) as ContributePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof payload.syndicateId !== "string" || !payload.syndicateId.trim()) {
    return NextResponse.json(
      { error: "syndicateId must be a non-empty string." },
      { status: 400 },
    );
  }

  if (typeof payload.amount !== "number" || Number.isNaN(payload.amount)) {
    return NextResponse.json(
      { error: "amount must be a valid number." },
      { status: 400 },
    );
  }

  try {
    const result = await contributeToSyndicate({
      syndicateId: payload.syndicateId.trim(),
      amount: payload.amount,
    });
    const snapshot = await getLandingSnapshot();
    return NextResponse.json(
      {
        ...result,
        snapshot,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/syndicates/contribute] write failed", {
      payload,
      error,
    });
    if (error instanceof MonolithValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to contribute to syndicate.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
