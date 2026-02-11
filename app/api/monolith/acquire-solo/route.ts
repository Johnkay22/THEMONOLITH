import { NextResponse } from "next/server";
import {
  acquireSolo,
  getLandingSnapshot,
  MonolithValidationError,
} from "@/lib/protocol/monolith";

type AcquireSoloPayload = {
  content: string;
  bidAmount: number;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: AcquireSoloPayload;
  try {
    payload = (await request.json()) as AcquireSoloPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (typeof payload.content !== "string") {
    return NextResponse.json({ error: "content must be a string." }, { status: 400 });
  }

  if (typeof payload.bidAmount !== "number" || Number.isNaN(payload.bidAmount)) {
    return NextResponse.json(
      { error: "bidAmount must be a valid number." },
      { status: 400 },
    );
  }

  try {
    const result = await acquireSolo({
      content: payload.content,
      bidAmount: payload.bidAmount,
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
    if (error instanceof MonolithValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to acquire monolith.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
