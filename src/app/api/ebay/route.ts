import { NextResponse } from "next/server";
import { ebayReference } from "@/lib/ebay";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const marketplace = searchParams.get("marketplace") || "EBAY_US";
  if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });
  try {
    const ref = await ebayReference(q, marketplace);
    return NextResponse.json(ref);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
