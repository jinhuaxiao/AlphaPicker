import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/sorftime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const site = searchParams.get("site") || "US";
  if (!q) return NextResponse.json({ items: [] });
  try {
    const items = (await searchProducts(q, site)).slice(0, 10);
    return NextResponse.json({ items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
