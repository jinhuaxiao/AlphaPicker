// Domain types for AlphaPicker.

export type ExperienceLevel = "novice" | "intermediate" | "veteran";
export type SalesBand = "lt5w" | "5to30w" | "30to100w" | "100wplus";
export type EvaluationStatus = "recommend" | "watch" | "avoid" | "draft";
export type Competition = "high" | "mid" | "low";

export interface Seller {
  id: number;
  name: string;
  experience: ExperienceLevel;
  sales_band: SalesBand;
  categories: string[];
  risk_preference: number; // 0 (保守) .. 100 (激进)
  per_product_budget_cny: number; // 单品可投入资金
  platforms: string[];
  plan: string; // e.g. "专业版"
  eval_quota_used: number;
  eval_quota_total: number;
  onboarded: boolean;
}

// The five favorability scores (0-100, higher = better) plus their inverted-raw twins.
export interface DimensionScores {
  demand: number; // 需求规模
  competition: number; // 竞争 (favorability — higher = less competition)
  profit: number; // 利润空间
  differentiation: number; // 差异化空间
  risk: number; // 风险 (favorability — higher = lower risk)
}

export interface Evaluation {
  id: number;
  seller_id: number;
  asin: string;
  name: string;
  category_path: string;
  target_market: string;
  image_url: string | null;

  // Economic parameters
  price_usd: number;
  cost_cny: number;
  freight_cny: number; // 头程物流 / 件
  fba_fee_usd: number;
  commission_pct: number; // 平台佣金
  coupon_pct: number; // Coupon / 折扣
  return_rate_pct: number; // 退货率

  // Market parameters
  main_keyword: string;
  secondary_keywords: string[];
  target_monthly_units: number;
  est_acos_pct: number;
  conversion_pct: number;

  // Derived / scoring
  scores: DimensionScores;
  composite: number; // 综合评分 0-100
  status: EvaluationStatus;

  // Headline metrics surfaced on the scorecard
  monthly_search: number; // 月搜索
  weighted_cpc: number; // 加权 CPC
  top3_concentration: number; // 头部 3 家集中度 (%)
  gross_margin_pct: number; // 毛利率

  created_at: string;
  updated_at: string;
}

export interface Keyword {
  id: number;
  evaluation_id: number;
  keyword: string;
  monthly_search: number;
  cpc: number;
  competition: Competition;
  top1_pct: number;
  top3_pct: number;
  traffic_share_pct: number;
  position: number;
}

export const STATUS_META: Record<
  EvaluationStatus,
  { label: string; tone: "green" | "orange" | "red" | "ink" }
> = {
  recommend: { label: "推荐进入", tone: "green" },
  watch: { label: "观望", tone: "orange" },
  avoid: { label: "不建议", tone: "red" },
  draft: { label: "草稿", tone: "ink" },
};

export const EXPERIENCE_META: Record<ExperienceLevel, string> = {
  novice: "新手 < 1 年",
  intermediate: "进阶 1-3 年",
  veteran: "资深 3 年+",
};

export const SALES_BAND_META: Record<SalesBand, string> = {
  lt5w: "< ¥5万",
  "5to30w": "¥5-30万",
  "30to100w": "¥30-100万",
  "100wplus": "¥100万+",
};
