import { NextResponse } from "next/server";
import { getSyndicateContributorNames } from "@/lib/protocol/monolith";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const syndicateId = url.searchParams.get("syndicateId")?.trim();
  if (!syndicateId) {
    return NextResponse.json(
      { error: "syndicateId query parameter is required." },
      { status: 400 },
    );
  }

  const contributors = await getSyndicateContributorNames(syndicateId);
  return NextResponse.json(
    { contributors },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
