import { NextResponse } from "next/server";
import { getSeller } from "@/lib/queries";
import { analyzeReviews, saveReviewInsight } from "@/lib/reviews";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "no seller" }, { status: 404 });

  const { asin, site } = await req.json();
  const code = String(asin || "").trim();
  if (!code) return NextResponse.json({ error: "缺少 asin" }, { status: 400 });

  try {
    const insight = await analyzeReviews(code, String(site || "US").trim());
    if (!insight) {
      return NextResponse.json({ ok: true, insight: null, message: "暂无可用评论" });
    }
    await saveReviewInsight(seller.id, code, String(site || "US").trim(), insight);
    return NextResponse.json({ ok: true, insight });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
