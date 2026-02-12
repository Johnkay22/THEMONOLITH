import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { getLandingSnapshot } from "@/lib/protocol/monolith";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  noStore();
  const snapshot = await getLandingSnapshot();
  return NextResponse.json(snapshot, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
    },
  });
}
