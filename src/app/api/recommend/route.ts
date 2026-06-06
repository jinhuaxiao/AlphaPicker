import { NextResponse } from "next/server";
import { getSeller } from "@/lib/queries";
import { recommendForSeller } from "@/lib/recommend";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "no seller" }, { status: 404 });
  const v = Number(new URL(req.url).searchParams.get("v") || "0") || 0;
  try {
    const items = await recommendForSeller(seller, 8, v);
    return NextResponse.json({ items, seller: { categories: seller.categories } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
