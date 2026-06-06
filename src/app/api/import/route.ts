import { NextResponse } from "next/server";
import { getSeller } from "@/lib/queries";
import { importByAsin, importByQuery, importByEbayKeyword } from "@/lib/importProduct";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const seller = await getSeller();
  if (!seller) return NextResponse.json({ error: "no seller" }, { status: 404 });

  const { asin, query, site, source, cost_cny, freight_cny } = await req.json();
  const opts: { costCny?: number; freightCny?: number } = {};
  if (cost_cny !== undefined && cost_cny !== null && cost_cny !== "" && Number(cost_cny) > 0)
    opts.costCny = Number(cost_cny);
  if (freight_cny !== undefined && freight_cny !== null && freight_cny !== "" && Number(freight_cny) >= 0)
    opts.freightCny = Number(freight_cny);
  try {
    let result;
    if (source === "ebay") {
      const kw = String(query || asin || "").trim();
      if (!kw) return NextResponse.json({ error: "缺少关键词" }, { status: 400 });
      result = await importByEbayKeyword(seller, kw, opts);
    } else if (asin) {
      result = await importByAsin(seller, String(asin).trim(), site || "US", opts);
    } else if (query) {
      result = await importByQuery(seller, String(query).trim(), site || "US", opts);
    } else {
      return NextResponse.json({ error: "缺少 asin 或 query" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
