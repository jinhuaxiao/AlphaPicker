import type {
  DimensionScores,
  EvaluationStatus,
  ExperienceLevel,
} from "./types";

export interface DimensionWeights {
  demand: number;
  competition: number;
  profit: number;
  differentiation: number;
  risk: number;
}

// "新手更重风险，老兵更重规模" — weights shift with the seller profile.
export const WEIGHTS_BY_EXPERIENCE: Record<ExperienceLevel, DimensionWeights> = {
  novice: { demand: 20, competition: 25, profit: 25, differentiation: 10, risk: 20 },
  intermediate: { demand: 25, competition: 20, profit: 25, differentiation: 15, risk: 15 },
  veteran: { demand: 30, competition: 15, profit: 25, differentiation: 20, risk: 10 },
};

export const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  demand: "需求规模",
  competition: "竞争强度",
  profit: "利润空间",
  differentiation: "差异化空间",
  risk: "风险系数",
};

const PROMOTE_THRESHOLD = 60; // 推进门槛 60
const AVOID_THRESHOLD = 45;

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

/** Weighted composite (0-100) using profile weights. */
export function compositeScore(
  scores: DimensionScores,
  experience: ExperienceLevel,
): number {
  const w = WEIGHTS_BY_EXPERIENCE[experience];
  const total = w.demand + w.competition + w.profit + w.differentiation + w.risk;
  const sum =
    scores.demand * w.demand +
    scores.competition * w.competition +
    scores.profit * w.profit +
    scores.differentiation * w.differentiation +
    scores.risk * w.risk;
  return Math.round(sum / total);
}

export function statusFromComposite(
  composite: number,
  riskFavorability: number,
): EvaluationStatus {
  if (composite >= PROMOTE_THRESHOLD && riskFavorability >= 40) return "recommend";
  if (composite < AVOID_THRESHOLD || riskFavorability < 30) return "avoid";
  return "watch";
}

/**
 * 需求规模 (0-100). Blends keyword search demand (primary signal) with real
 * category capacity (TAM = Top100 monthly units) when available. A single
 * keyword's search volume alone is narrow; TAM grounds it in the actual market
 * size. Mapping (log-scaled): 50k searches/mo → 100; 2M units/mo → 100.
 * With TAM present: 0.6·search + 0.4·TAM. Without TAM: search only (back-compat).
 */
export function demandScore(monthlySearch: number, tamUnits = 0): number {
  const search = clamp(
    Math.round((Math.log10(Math.max(monthlySearch, 1)) / Math.log10(50000)) * 100),
  );
  if (tamUnits <= 0) return search;
  const tam = clamp(
    Math.round((Math.log10(Math.max(tamUnits, 1)) / Math.log10(2_000_000)) * 100),
  );
  return clamp(Math.round(search * 0.6 + tam * 0.4));
}

export interface ScoringInputs {
  monthlySearch: number; // 月搜索
  tamUnits?: number; // 类目 Top100 月销量 (market capacity); optional
  top3Concentration: number; // 头部 3 家集中度 %
  grossMarginPct: number; // 毛利率
  unfilledSellingPoints: number; // 未填补卖点数 (0-5)
  returnRatePct: number; // 退货率
  acosSafetyPt: number; // ACOS 安全边际 (pt)
}

/**
 * Derive the five favorability scores from raw market + economic signals.
 * Each axis maps a signal onto a 0-100 "higher = better" scale.
 */
export function deriveScores(input: ScoringInputs): DimensionScores {
  // 需求规模: keyword search blended with real category capacity (TAM).
  const demand = demandScore(input.monthlySearch, input.tamUnits ?? 0);

  // 竞争 (favorability): lower head concentration = friendlier. 68% concentration -> ~60.
  const competition = clamp(Math.round(100 - (input.top3Concentration - 20) * 1.25));

  // 利润空间: gross margin mapped, 39% -> ~72.
  const profit = clamp(Math.round(input.grossMarginPct * 1.85));

  // 差异化空间: more unfilled selling points = more room. 3 -> ~55.
  const differentiation = clamp(Math.round(20 + input.unfilledSellingPoints * 11));

  // 风险 (favorability): low return rate + ACOS headroom = safer. -> ~65.
  const risk = clamp(
    Math.round(75 - input.returnRatePct * 4 + Math.min(input.acosSafetyPt, 15) * 1.5),
  );

  return { demand, competition, profit, differentiation, risk };
}
