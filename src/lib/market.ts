// Real market capacity & trend analysis. Runs server-side: from Sorftime's
// category_report (类目统计报告), category_trend and product_trend it derives the
// addressable market size (TAM), competitive structure, price band, review moat,
// YoY growth and seasonality — the "市场容量与趋势" surfaced on the report page.

import { pool } from "./db";
import {
  categoryReport,
  categoryTrend,
  productTrend,
  type CategoryReport,
  type TrendPoint,
} from "./sorftime";

export interface MarketInsight {
  nodeId: string;
  categoryName: string;
  tamUnits: number; // Top100 monthly units — market capacity proxy
  tamRevenueUsd: number; // Top100 monthly revenue
  top3ProductShare: number; // % — head-product concentration
  top3BrandShare: number; // %
  top3SellerShare: number; // %
  amazonOwnedShare: number; // % sold by Amazon itself (entry risk)
  avgPrice: number;
  medianPrice: number;
  highReviewsShare: number; // % of sales from >1000-review products (review moat)
  growthYoyPct: number;
  peakMonth: string; // seasonality peak, e.g. "11月"
  categoryTrend: TrendPoint[];
  productTrend: TrendPoint[];
}

/** Take the last number in a Sorftime stat string (handles "标签：12.3" / "13.19%" / "2,875,677"). */
function lastNum(v: unknown): number {
  const nums = String(v ?? "").match(/-?\d[\d,]*\.?\d*/g);
  if (!nums || !nums.length) return 0;
  return Number(nums[nums.length - 1].replace(/,/g, ""));
}

/** Head-product concentration (%) straight from the category stats block. */
export function categoryTop3Share(report: CategoryReport | null): number | null {
  if (!report) return null;
  const v = lastNum(report.stats["top3_product_sales_volume_share"]);
  return v > 0 ? Math.round(v) : null;
}

function trendStats(series: TrendPoint[]): { growthYoyPct: number; peakMonth: string } {
  if (series.length < 2) return { growthYoyPct: 0, peakMonth: "" };
  const vals = series.map((p) => p.value);
  let growthYoyPct = 0;
  if (series.length >= 13) {
    const last = vals[vals.length - 1];
    const prev = vals[vals.length - 13];
    if (prev > 0) growthYoyPct = Math.round(((last - prev) / prev) * 100);
  } else {
    const last = vals[vals.length - 1];
    const first = vals[0];
    if (first > 0) growthYoyPct = Math.round(((last - first) / first) * 100);
  }
  // Seasonality: calendar month with the highest average across years.
  const byMonth = new Map<string, number[]>();
  for (const p of series) {
    const mm = p.month.slice(5);
    const arr = byMonth.get(mm) ?? [];
    arr.push(p.value);
    byMonth.set(mm, arr);
  }
  let peakMonth = "";
  let best = -1;
  for (const [mm, arr] of byMonth) {
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    if (avg > best) {
      best = avg;
      peakMonth = mm;
    }
  }
  return { growthYoyPct, peakMonth: peakMonth ? `${Number(peakMonth)}月` : "" };
}

/**
 * Build a market insight for an ASIN's category. `preloaded` lets the import path
 * reuse a category_report it already fetched (for the top3 concentration score),
 * avoiding a duplicate call. Returns null when no category stats are available.
 */
export async function analyzeMarket(
  asin: string,
  nodeId: string,
  site = "US",
  preloaded?: CategoryReport | null,
): Promise<MarketInsight | null> {
  if (!nodeId) return null;
  const report = preloaded ?? (await categoryReport(nodeId, site));
  if (!report || Object.keys(report.stats).length === 0) return null;
  const s = report.stats;

  const [catTrend, prodTrend] = await Promise.all([
    categoryTrend(nodeId, "SalesCount", site).catch(() => [] as TrendPoint[]),
    productTrend(asin, "SalesVolume", site).catch(() => [] as TrendPoint[]),
  ]);
  const { growthYoyPct, peakMonth } = trendStats(catTrend);

  return {
    nodeId,
    categoryName: String(s["类目名称"] ?? ""),
    tamUnits: Math.round(lastNum(s["top100产品月销量"])),
    tamRevenueUsd: Math.round(lastNum(s["top100产品月销额"])),
    top3ProductShare: lastNum(s["top3_product_sales_volume_share"]),
    top3BrandShare: lastNum(s["top3_brands_sales_volume_share"]),
    top3SellerShare: lastNum(s["top3_seller_sales_volume_share"]),
    amazonOwnedShare: lastNum(s["amazonOwned_sales_volume_share"]),
    avgPrice: Number(lastNum(s["average_price"]).toFixed(2)),
    medianPrice: Number(lastNum(s["median_price"]).toFixed(2)),
    highReviewsShare: lastNum(s["high_reviews_sales_volume_share"]),
    growthYoyPct,
    peakMonth,
    categoryTrend: catTrend,
    productTrend: prodTrend,
  };
}

/** Upsert a market insight, keyed by (seller, asin, site). */
export async function saveMarketInsight(
  sellerId: number,
  asin: string,
  site: string,
  mi: MarketInsight,
): Promise<void> {
  await pool.query(
    `INSERT INTO market_insights
       (seller_id, asin, amz_site, node_id, category_name, tam_units, tam_revenue_usd,
        top3_product_share, top3_brand_share, top3_seller_share, amazon_owned_share,
        avg_price, median_price, high_reviews_share, growth_yoy_pct, peak_month,
        category_trend, product_trend, fetched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, now())
     ON CONFLICT (seller_id, asin, amz_site) DO UPDATE SET
       node_id=EXCLUDED.node_id, category_name=EXCLUDED.category_name,
       tam_units=EXCLUDED.tam_units, tam_revenue_usd=EXCLUDED.tam_revenue_usd,
       top3_product_share=EXCLUDED.top3_product_share, top3_brand_share=EXCLUDED.top3_brand_share,
       top3_seller_share=EXCLUDED.top3_seller_share, amazon_owned_share=EXCLUDED.amazon_owned_share,
       avg_price=EXCLUDED.avg_price, median_price=EXCLUDED.median_price,
       high_reviews_share=EXCLUDED.high_reviews_share, growth_yoy_pct=EXCLUDED.growth_yoy_pct,
       peak_month=EXCLUDED.peak_month, category_trend=EXCLUDED.category_trend,
       product_trend=EXCLUDED.product_trend, fetched_at=now()`,
    [
      sellerId, asin, site, mi.nodeId, mi.categoryName, mi.tamUnits, mi.tamRevenueUsd,
      mi.top3ProductShare, mi.top3BrandShare, mi.top3SellerShare, mi.amazonOwnedShare,
      mi.avgPrice, mi.medianPrice, mi.highReviewsShare, mi.growthYoyPct, mi.peakMonth,
      JSON.stringify(mi.categoryTrend), JSON.stringify(mi.productTrend),
    ] as never[],
  );
}
