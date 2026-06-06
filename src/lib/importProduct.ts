import { pool } from "./db";
import {
  productDetail,
  trafficTerms,
  categoryReport,
  searchProducts,
  type TrafficTerm,
} from "./sorftime";
import {
  compositeScore,
  deriveScores,
  statusFromComposite,
  clamp,
} from "./scoring";
import { acosSafety } from "./economics";
import { ebayMarket } from "./ebay";
import { analyzeReviews, saveReviewInsight } from "./reviews";
import { analyzeMarket, saveMarketInsight, categoryTop3Share } from "./market";
import type { Seller } from "./types";

const FX = 7.2;

function competitionTier(cpc: number): "high" | "mid" | "low" {
  if (cpc >= 1.2) return "high";
  if (cpc >= 0.7) return "mid";
  return "low";
}

function weightedCpc(terms: TrafficTerm[]): number {
  const totalVol = terms.reduce((a, t) => a + t.monthlySearch, 0);
  if (!totalVol) return terms[0]?.recommendedCpc ?? 0;
  return terms.reduce((a, t) => a + t.recommendedCpc * t.monthlySearch, 0) / totalVol;
}

export interface ImportResult {
  asin: string;
  composite: number;
  status: string;
  source: "sorftime" | "ebay";
  grossMarginPct: number;
  costEstimated: boolean;
}

export interface ImportOpts {
  /** Real per-unit purchase cost (CNY). When given, both the profit score and the P&L use it. */
  costCny?: number;
  /** Real per-unit first-leg freight (CNY). */
  freightCny?: number;
}

/** Pull real Sorftime data for an ASIN, score it, and upsert an evaluation. */
export async function importByAsin(
  seller: Seller,
  asin: string,
  site = "US",
  opts: ImportOpts = {},
): Promise<ImportResult> {
  const [detail, termsRaw] = await Promise.all([
    productDetail(asin, site),
    trafficTerms(asin, site),
  ]);
  if (!detail.price) throw new Error(`未能从 Sorftime 获取 ${asin} 的产品数据`);

  const terms = termsRaw
    .filter((t) => t.monthlySearch > 0)
    .sort((a, b) => b.monthlySearch - a.monthlySearch)
    .slice(0, 15);

  // One category_report fetch powers both the concentration score and the
  // market-capacity insight below (reused via `report`).
  const report = detail.nodeId
    ? await categoryReport(detail.nodeId, site).catch(() => null)
    : null;
  const top3 = categoryTop3Share(report) ?? 55;

  const price = detail.price;
  const fba = detail.fbaFee || Number((price * 0.28).toFixed(2));

  // Purchase cost isn't in Sorftime data. Use the caller's real COGS when given,
  // otherwise estimate it from price. Either way the margin below is derived from
  // the SAME cost the P&L uses, so the profit score and net profit stay aligned.
  const hasRealCost = opts.costCny != null && opts.costCny > 0;
  let costCny: number;
  let freightCny: number;
  if (hasRealCost) {
    costCny = Number(opts.costCny);
    freightCny =
      opts.freightCny != null && opts.freightCny >= 0
        ? Number(opts.freightCny)
        : Number((price * FX * 0.06).toFixed(1));
  } else {
    const landedCny = price * FX * 0.3;
    costCny = Number((landedCny * 0.8).toFixed(1));
    freightCny =
      opts.freightCny != null && opts.freightCny >= 0
        ? Number(opts.freightCny)
        : Number((landedCny * 0.2).toFixed(1));
  }

  const wcpc = Number(weightedCpc(terms).toFixed(2));
  const headSearch = terms[0]?.monthlySearch ?? 0;
  const estAcos = clamp(Math.round(15 + wcpc * 10), 12, 40);
  const conversion = 8;
  const returnRate = 3.5;
  const targetUnits = clamp(Math.round(detail.monthlyUnits * 0.04), 100, 2000);

  const pnlInputs = {
    priceUsd: price,
    costCny,
    freightCny,
    fbaFeeUsd: fba,
    commissionPct: 15,
    couponPct: 0,
    returnRatePct: returnRate,
    monthlyUnits: targetUnits,
    acosPct: estAcos,
  };
  const safety = acosSafety(pnlInputs).safetyPt;

  // Pre-ad gross margin derived from the SAME landed cost the P&L uses → score and
  // net profit reconcile. (Sorftime's 毛利率 ignores purchase cost, so we don't use it here.)
  const amazonFeeUsd = price * 0.15 + fba;
  const landedUsd = (costCny + freightCny) / FX;
  const grossMargin = price
    ? Math.round(((price - amazonFeeUsd - landedUsd) / price) * 100)
    : 0;

  const scores = deriveScores({
    monthlySearch: headSearch || 1000,
    top3Concentration: top3,
    grossMarginPct: grossMargin,
    unfilledSellingPoints: clamp(Math.round(5 - detail.star), 1, 5),
    returnRatePct: returnRate,
    acosSafetyPt: safety,
  });
  const composite = compositeScore(scores, seller.experience);
  const status = statusFromComposite(composite, scores.risk);

  const categoryPath = [detail.category, detail.subcategory]
    .filter(Boolean)
    .join(" › ");
  const name = detail.title.slice(0, 80) || asin;
  const mainKw = terms[0]?.keyword ?? "";
  const secondary = terms.slice(1, 4).map((t) => t.keyword);

  const res = await pool.query(
    `INSERT INTO evaluations (
        seller_id, asin, name, category_path, target_market, image_url,
        price_usd, cost_cny, freight_cny, fba_fee_usd, commission_pct, coupon_pct, return_rate_pct,
        main_keyword, secondary_keywords, target_monthly_units, est_acos_pct, conversion_pct,
        score_demand, score_competition, score_profit, score_differentiation, score_risk,
        composite, status, monthly_search, weighted_cpc, top3_concentration, gross_margin_pct, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, now())
     ON CONFLICT (seller_id, asin) DO UPDATE SET
        name=EXCLUDED.name, category_path=EXCLUDED.category_path, image_url=EXCLUDED.image_url,
        price_usd=EXCLUDED.price_usd, cost_cny=EXCLUDED.cost_cny, freight_cny=EXCLUDED.freight_cny,
        fba_fee_usd=EXCLUDED.fba_fee_usd, return_rate_pct=EXCLUDED.return_rate_pct,
        main_keyword=EXCLUDED.main_keyword, secondary_keywords=EXCLUDED.secondary_keywords,
        target_monthly_units=EXCLUDED.target_monthly_units, est_acos_pct=EXCLUDED.est_acos_pct,
        score_demand=EXCLUDED.score_demand, score_competition=EXCLUDED.score_competition,
        score_profit=EXCLUDED.score_profit, score_differentiation=EXCLUDED.score_differentiation,
        score_risk=EXCLUDED.score_risk, composite=EXCLUDED.composite, status=EXCLUDED.status,
        monthly_search=EXCLUDED.monthly_search, weighted_cpc=EXCLUDED.weighted_cpc,
        top3_concentration=EXCLUDED.top3_concentration, gross_margin_pct=EXCLUDED.gross_margin_pct,
        updated_at=now()
     RETURNING id`,
    [
      seller.id, detail.asin || asin, name, categoryPath, `Amazon ${site}`, detail.image || null,
      price, costCny, freightCny, fba, 15, 0, returnRate,
      mainKw, secondary, targetUnits, estAcos, conversion,
      scores.demand, scores.competition, scores.profit, scores.differentiation, scores.risk,
      composite, status, headSearch, wcpc, top3, grossMargin,
    ] as never[],
  );
  const evalId = res.rows[0].id as number;

  // Replace keyword rows with the real reverse-ASIN terms.
  await pool.query("DELETE FROM keywords WHERE evaluation_id = $1", [evalId]);
  const totalVol = terms.reduce((a, t) => a + t.monthlySearch, 0) || 1;
  let pos = 1;
  for (const t of terms) {
    const top3pct = clamp(Math.round(35 + (t.recommendedCpc - 0.7) * 30), 20, 82);
    const top1pct = Math.round(top3pct * 0.42);
    await pool.query(
      `INSERT INTO keywords (evaluation_id, keyword, monthly_search, cpc, competition,
          top1_pct, top3_pct, traffic_share_pct, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        evalId, t.keyword, t.monthlySearch, t.recommendedCpc, competitionTier(t.recommendedCpc),
        top1pct, top3pct, Math.round((t.monthlySearch / totalVol) * 100), pos++,
      ] as never[],
    );
  }

  // Real review VOC — best effort; a review failure must never block scoring.
  try {
    const insight = await analyzeReviews(detail.asin || asin, site);
    if (insight) await saveReviewInsight(seller.id, detail.asin || asin, site, insight);
  } catch (err) {
    console.warn(`review analysis failed for ${asin}:`, (err as Error).message);
  }

  // Real market capacity & trend — best effort; reuses the category_report above.
  try {
    const mi = await analyzeMarket(detail.asin || asin, detail.nodeId, site, report);
    if (mi) await saveMarketInsight(seller.id, detail.asin || asin, site, mi);
  } catch (err) {
    console.warn(`market analysis failed for ${asin}:`, (err as Error).message);
  }

  return {
    asin: detail.asin || asin,
    composite,
    status,
    source: "sorftime",
    grossMarginPct: grossMargin,
    costEstimated: !hasRealCost,
  };
}

export async function importByQuery(
  seller: Seller,
  query: string,
  site = "US",
  opts: ImportOpts = {},
): Promise<ImportResult> {
  const results = await searchProducts(query, site);
  const first = results.find((r) => r.asin);
  if (!first) throw new Error(`Sorftime 未找到与「${query}」相关的产品`);
  return importByAsin(seller, first.asin, site, opts);
}

/**
 * Build a real evaluation from the eBay Browse API (used when Sorftime is over
 * quota, or when the user picks eBay). eBay gives real price/image/category,
 * market size (listing count), seller concentration and related title terms.
 */
export async function importByEbayKeyword(
  seller: Seller,
  keyword: string,
  opts: ImportOpts = {},
): Promise<ImportResult> {
  const market = await ebayMarket(keyword, "EBAY_US", 50);
  const rep = market.representative;
  if (!rep || !market.priceMedian) {
    throw new Error(`eBay 未找到与「${keyword}」相关的在售商品`);
  }

  const price = market.priceMedian;
  const fba = Number((2.5 + price * 0.12).toFixed(2)); // eBay has no FBA — estimate

  const hasRealCost = opts.costCny != null && opts.costCny > 0;
  const landedCny = price * FX * 0.3;
  const costCny = hasRealCost ? Number(opts.costCny) : Number((landedCny * 0.8).toFixed(1));
  const freightCny =
    opts.freightCny != null && opts.freightCny >= 0
      ? Number(opts.freightCny)
      : Number((hasRealCost ? price * FX * 0.06 : landedCny * 0.2).toFixed(1));

  const wcpc = Number(clamp(0.4 + price * 0.05, 0.4, 2.5).toFixed(2));
  const estAcos = clamp(Math.round(15 + wcpc * 10), 12, 40);
  const conversion = 8;
  const returnRate = 3.5;
  const top3 = market.top3SellerSharePct || 40;
  const targetUnits = clamp(Math.round(market.total / 220), 100, 1500);

  const pnlInputs = {
    priceUsd: price,
    costCny,
    freightCny,
    fbaFeeUsd: fba,
    commissionPct: 15,
    couponPct: 0,
    returnRatePct: returnRate,
    monthlyUnits: targetUnits,
    acosPct: estAcos,
  };
  const safety = acosSafety(pnlInputs).safetyPt;

  const amazonFeeUsd = price * 0.15 + fba;
  const landedUsd = (costCny + freightCny) / FX;
  const grossMargin = price ? Math.round(((price - amazonFeeUsd - landedUsd) / price) * 100) : 0;

  const scores = deriveScores({
    monthlySearch: Math.max(market.total, 1000),
    top3Concentration: top3,
    grossMarginPct: grossMargin,
    unfilledSellingPoints: clamp(Math.round(5 - rep.feedback / 5000), 1, 5),
    returnRatePct: returnRate,
    acosSafetyPt: safety,
  });
  const composite = compositeScore(scores, seller.experience);
  const status = statusFromComposite(composite, scores.risk);

  const id = `EB${rep.legacyId}`.slice(0, 16);
  const name = rep.title.slice(0, 80);
  const mainKw = market.related[0]?.term ?? keyword;
  const secondary = market.related.slice(1, 4).map((r) => r.term);

  const res = await pool.query(
    `INSERT INTO evaluations (
        seller_id, asin, name, category_path, target_market, image_url,
        price_usd, cost_cny, freight_cny, fba_fee_usd, commission_pct, coupon_pct, return_rate_pct,
        main_keyword, secondary_keywords, target_monthly_units, est_acos_pct, conversion_pct,
        score_demand, score_competition, score_profit, score_differentiation, score_risk,
        composite, status, monthly_search, weighted_cpc, top3_concentration, gross_margin_pct, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29, now())
     ON CONFLICT (seller_id, asin) DO UPDATE SET
        name=EXCLUDED.name, category_path=EXCLUDED.category_path, image_url=EXCLUDED.image_url,
        price_usd=EXCLUDED.price_usd, cost_cny=EXCLUDED.cost_cny, freight_cny=EXCLUDED.freight_cny,
        fba_fee_usd=EXCLUDED.fba_fee_usd, main_keyword=EXCLUDED.main_keyword,
        secondary_keywords=EXCLUDED.secondary_keywords, target_monthly_units=EXCLUDED.target_monthly_units,
        est_acos_pct=EXCLUDED.est_acos_pct, score_demand=EXCLUDED.score_demand,
        score_competition=EXCLUDED.score_competition, score_profit=EXCLUDED.score_profit,
        score_differentiation=EXCLUDED.score_differentiation, score_risk=EXCLUDED.score_risk,
        composite=EXCLUDED.composite, status=EXCLUDED.status, monthly_search=EXCLUDED.monthly_search,
        weighted_cpc=EXCLUDED.weighted_cpc, top3_concentration=EXCLUDED.top3_concentration,
        gross_margin_pct=EXCLUDED.gross_margin_pct, updated_at=now()
     RETURNING id`,
    [
      seller.id, id, name, rep.category, "eBay US", rep.image || null,
      price, costCny, freightCny, fba, 15, 0, returnRate,
      mainKw, secondary, targetUnits, estAcos, conversion,
      scores.demand, scores.competition, scores.profit, scores.differentiation, scores.risk,
      composite, status, market.total, wcpc, top3, grossMargin,
    ] as never[],
  );
  const evalId = res.rows[0].id as number;

  await pool.query("DELETE FROM keywords WHERE evaluation_id = $1", [evalId]);
  let pos = 1;
  for (const t of market.related) {
    const kwCpc = Number(clamp(wcpc * (0.7 + t.sharePct / 100), 0.3, 2.5).toFixed(2));
    const top3pct = clamp(Math.round(25 + t.sharePct), 18, 80);
    await pool.query(
      `INSERT INTO keywords (evaluation_id, keyword, monthly_search, cpc, competition,
          top1_pct, top3_pct, traffic_share_pct, position)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        evalId, t.term, Math.round((market.total * t.sharePct) / 100), kwCpc,
        competitionTier(kwCpc), Math.round(top3pct * 0.42), top3pct, t.sharePct, pos++,
      ] as never[],
    );
  }

  return { asin: id, composite, status, source: "ebay", grossMarginPct: grossMargin, costEstimated: !hasRealCost };
}
