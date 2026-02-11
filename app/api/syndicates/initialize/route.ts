import { NextResponse } from "next/server";
import {
  getLandingSnapshot,
  initializeSyndicate,
  MonolithValidationError,
} from "@/lib/protocol/monolith";

type InitializeSyndicatePayload = {
  proposedContent: string;
  initialContribution: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: InitializeSyndicatePayload;
  try {
    payload = (await request.json()) as InitializeSyndicatePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof payload.proposedContent !== "string") {
    return NextResponse.json(
      { error: "proposedContent must be a string." },
      { status: 400 },
    );
  }

  if (
    typeof payload.initialContribution !== "number" ||
    Number.isNaN(payload.initialContribution)
  ) {
    return NextResponse.json(
      { error: "initialContribution must be a valid number." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await initializeSyndicate({
      proposedContent: payload.proposedContent,
      initialContribution: payload.initialContribution,
    });
  } catch (error) {
    console.error("[api/syndicates/initialize] write failed", {
      payload,
      error,
    });
    if (error instanceof MonolithValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error
        ? error.message
        : "Failed to initialize syndicate.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  let snapshot = null;
  try {
    snapshot = await getLandingSnapshot();
  } catch (snapshotError) {
    console.error("[api/syndicates/initialize] snapshot read failed", {
      payload,
      snapshotError,
    });
  }

  return NextResponse.json(
    {
      ...result,
      snapshot,
    },
    { status: 200 },
  );
}
