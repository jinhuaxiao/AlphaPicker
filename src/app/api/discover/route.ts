import { NextResponse } from "next/server";
import { getSeller } from "@/lib/queries";
import {
  searchCategories,
  potentialProducts,
  type CategoryFilters,
  type PotentialFilters,
} from "@/lib/sorftime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "no seller" }, { status: 404 });

  const { mode, filters } = await req.json();
  try {
    if (mode === "product") {
      const items = await potentialProducts((filters || {}) as PotentialFilters);
      return NextResponse.json({ ok: true, mode, items });
    }
    const items = await searchCategories((filters || {}) as CategoryFilters);
    return NextResponse.json({ ok: true, mode: "category", items });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
