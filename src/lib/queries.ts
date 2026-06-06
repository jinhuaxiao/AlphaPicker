import { query, queryOne } from "./db";
import type { ReviewInsight, ReviewPainPoint } from "./reviews";
import type { MarketInsight } from "./market";
import type { TrendPoint } from "./sorftime";
import type {
  Evaluation,
  EvaluationStatus,
  Keyword,
  Seller,
} from "./types";

interface SellerRow {
  id: number;
  name: string;
  experience: string;
  sales_band: string;
  categories: string[];
  risk_preference: number;
  per_product_budget_cny: string;
  platforms: string[];
  plan: string;
  eval_quota_used: number;
  eval_quota_total: number;
  onboarded: boolean;
}

function mapSeller(r: SellerRow): Seller {
  return {
    id: r.id,
    name: r.name,
    experience: r.experience as Seller["experience"],
    sales_band: r.sales_band as Seller["sales_band"],
    categories: r.categories ?? [],
    risk_preference: Number(r.risk_preference),
    per_product_budget_cny: Number(r.per_product_budget_cny),
    platforms: r.platforms ?? [],
    plan: r.plan,
    eval_quota_used: r.eval_quota_used,
    eval_quota_total: r.eval_quota_total,
    onboarded: r.onboarded,
  };
}

interface EvalRow {
  id: number;
  seller_id: number;
  asin: string;
  name: string;
  category_path: string;
  target_market: string;
  image_url: string | null;
  price_usd: string;
  cost_cny: string;
  freight_cny: string;
  fba_fee_usd: string;
  commission_pct: string;
  coupon_pct: string;
  return_rate_pct: string;
  main_keyword: string;
  secondary_keywords: string[];
  target_monthly_units: number;
  est_acos_pct: string;
  conversion_pct: string;
  score_demand: number;
  score_competition: number;
  score_profit: number;
  score_differentiation: number;
  score_risk: number;
  composite: number;
  status: string;
  monthly_search: number;
  weighted_cpc: string;
  top3_concentration: string;
  gross_margin_pct: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function mapEval(r: EvalRow): Evaluation {
  return {
    id: r.id,
    seller_id: r.seller_id,
    asin: r.asin,
    name: r.name,
    category_path: r.category_path,
    target_market: r.target_market,
    image_url: r.image_url,
    price_usd: Number(r.price_usd),
    cost_cny: Number(r.cost_cny),
    freight_cny: Number(r.freight_cny),
    fba_fee_usd: Number(r.fba_fee_usd),
    commission_pct: Number(r.commission_pct),
    coupon_pct: Number(r.coupon_pct),
    return_rate_pct: Number(r.return_rate_pct),
    main_keyword: r.main_keyword,
    secondary_keywords: r.secondary_keywords ?? [],
    target_monthly_units: r.target_monthly_units,
    est_acos_pct: Number(r.est_acos_pct),
    conversion_pct: Number(r.conversion_pct),
    scores: {
      demand: r.score_demand,
      competition: r.score_competition,
      profit: r.score_profit,
      differentiation: r.score_differentiation,
      risk: r.score_risk,
    },
    composite: r.composite,
    status: r.status as EvaluationStatus,
    monthly_search: r.monthly_search,
    weighted_cpc: Number(r.weighted_cpc),
    top3_concentration: Number(r.top3_concentration),
    gross_margin_pct: Number(r.gross_margin_pct),
    created_at:
      r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    updated_at:
      r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
  };
}

export async function getSeller(): Promise<Seller | null> {
  const row = await queryOne<SellerRow>(
    "SELECT * FROM sellers ORDER BY id LIMIT 1",
  );
  return row ? mapSeller(row) : null;
}

export async function getEvaluations(sellerId: number): Promise<Evaluation[]> {
  const rows = await query<EvalRow>(
    "SELECT * FROM evaluations WHERE seller_id = $1 ORDER BY created_at DESC",
    [sellerId],
  );
  return rows.map(mapEval);
}

export async function getEvaluationByAsin(
  asin: string,
): Promise<Evaluation | null> {
  const row = await queryOne<EvalRow>(
    "SELECT * FROM evaluations WHERE asin = $1 LIMIT 1",
    [asin],
  );
  return row ? mapEval(row) : null;
}

interface KeywordRow {
  id: number;
  evaluation_id: number;
  keyword: string;
  monthly_search: number;
  cpc: string;
  competition: string;
  top1_pct: string;
  top3_pct: string;
  traffic_share_pct: string;
  position: number;
}

export async function getKeywords(evaluationId: number): Promise<Keyword[]> {
  const rows = await query<KeywordRow>(
    "SELECT * FROM keywords WHERE evaluation_id = $1 ORDER BY position",
    [evaluationId],
  );
  return rows.map((r) => ({
    id: r.id,
    evaluation_id: r.evaluation_id,
    keyword: r.keyword,
    monthly_search: r.monthly_search,
    cpc: Number(r.cpc),
    competition: r.competition as Keyword["competition"],
    top1_pct: Number(r.top1_pct),
    top3_pct: Number(r.top3_pct),
    traffic_share_pct: Number(r.traffic_share_pct),
    position: r.position,
  }));
}

interface ReviewInsightRow {
  review_count: number;
  pos_count: number;
  neg_count: number;
  avg_star: string;
  neg_ratio_pct: string;
  pain_points: ReviewPainPoint[];
}

/** Latest persisted review VOC insight for an ASIN (Amazon products only). */
export async function getReviewInsight(
  sellerId: number,
  asin: string,
): Promise<ReviewInsight | null> {
  const row = await queryOne<ReviewInsightRow>(
    `SELECT * FROM review_insights
       WHERE seller_id = $1 AND asin = $2
       ORDER BY fetched_at DESC LIMIT 1`,
    [sellerId, asin],
  );
  if (!row) return null;
  return {
    reviewCount: row.review_count,
    posCount: row.pos_count,
    negCount: row.neg_count,
    avgStar: Number(row.avg_star),
    negRatioPct: Number(row.neg_ratio_pct),
    painPoints: row.pain_points ?? [],
  };
}

interface MarketInsightRow {
  node_id: string;
  category_name: string;
  tam_units: string;
  tam_revenue_usd: string;
  top3_product_share: string;
  top3_brand_share: string;
  top3_seller_share: string;
  amazon_owned_share: string;
  avg_price: string;
  median_price: string;
  high_reviews_share: string;
  growth_yoy_pct: string;
  peak_month: string;
  category_trend: TrendPoint[];
  product_trend: TrendPoint[];
}

/** Latest persisted market capacity / trend insight for an ASIN. */
export async function getMarketInsight(
  sellerId: number,
  asin: string,
): Promise<MarketInsight | null> {
  const row = await queryOne<MarketInsightRow>(
    `SELECT * FROM market_insights
       WHERE seller_id = $1 AND asin = $2
       ORDER BY fetched_at DESC LIMIT 1`,
    [sellerId, asin],
  );
  if (!row) return null;
  return {
    nodeId: row.node_id,
    categoryName: row.category_name,
    tamUnits: Number(row.tam_units),
    tamRevenueUsd: Number(row.tam_revenue_usd),
    top3ProductShare: Number(row.top3_product_share),
    top3BrandShare: Number(row.top3_brand_share),
    top3SellerShare: Number(row.top3_seller_share),
    amazonOwnedShare: Number(row.amazon_owned_share),
    avgPrice: Number(row.avg_price),
    medianPrice: Number(row.median_price),
    highReviewsShare: Number(row.high_reviews_share),
    growthYoyPct: Number(row.growth_yoy_pct),
    peakMonth: row.peak_month,
    categoryTrend: row.category_trend ?? [],
    productTrend: row.product_trend ?? [],
  };
}

export function pnlInputsFor(e: Evaluation) {
  return {
    priceUsd: e.price_usd,
    costCny: e.cost_cny,
    freightCny: e.freight_cny,
    fbaFeeUsd: e.fba_fee_usd,
    commissionPct: e.commission_pct,
    couponPct: e.coupon_pct,
    returnRatePct: e.return_rate_pct,
    monthlyUnits: e.target_monthly_units || 1,
    acosPct: e.est_acos_pct,
  };
}
