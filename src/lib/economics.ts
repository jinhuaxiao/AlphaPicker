// Unit economics + P&L engine. Powers the simulator, ACOS page and scenarios.

export const FX_USD_CNY = 7.2; // USD -> CNY

export interface PnlInputs {
  priceUsd: number; // 售价
  costCny: number; // 采购成本
  freightCny: number; // 头程物流 / 件
  fbaFeeUsd: number; // FBA fee
  commissionPct: number; // 平台佣金 %
  couponPct: number; // Coupon / 折扣 %
  returnRatePct: number; // 退货率 %
  monthlyUnits: number; // 月销量
  acosPct: number; // ACOS %
}

export interface PnlResult {
  // per-unit, USD
  netRevenuePerUnit: number; // 售价扣 coupon
  amazonFeePerUnit: number; // 佣金 + FBA
  adCostPerUnit: number; // ACOS × 净售价
  landedCostPerUnit: number; // (采购 + 头程) 折美元
  contributionPerUnit: number;
  // monthly, CNY
  monthlyRevenueCny: number;
  monthlyNetCny: number;
  inventoryCostCny: number; // 备货资金 (月)
  adBudgetCny: number; // 广告预算 (月)
  capitalRequiredCny: number; // 资金需求
  // ratios
  netMarginPct: number; // 净利率
  roiPct: number; // 回报 / 备货 (近似年化)
  breakevenAcosPct: number; // 盈亏临界 ACOS
  paybackMonths: number; // 回本周期
}

export function computePnl(p: PnlInputs): PnlResult {
  const netRevenuePerUnit = p.priceUsd * (1 - p.couponPct / 100);
  const amazonFeePerUnit = p.priceUsd * (p.commissionPct / 100) + p.fbaFeeUsd;
  const adCostPerUnit = (p.acosPct / 100) * netRevenuePerUnit;
  const landedCostPerUnit = (p.costCny + p.freightCny) / FX_USD_CNY;

  const contributionPerUnit =
    netRevenuePerUnit - amazonFeePerUnit - adCostPerUnit - landedCostPerUnit;

  const effUnits = p.monthlyUnits * (1 - p.returnRatePct / 100);
  const monthlyNetUsd = contributionPerUnit * effUnits;
  const monthlyNetCny = monthlyNetUsd * FX_USD_CNY;
  const monthlyRevenueCny = netRevenuePerUnit * effUnits * FX_USD_CNY;

  const inventoryCostCny = p.monthlyUnits * (p.costCny + p.freightCny);
  const adBudgetCny = adCostPerUnit * p.monthlyUnits * FX_USD_CNY;
  const capitalRequiredCny = inventoryCostCny + adBudgetCny;

  const netMarginPct = netRevenuePerUnit
    ? (contributionPerUnit / netRevenuePerUnit) * 100
    : 0;

  // Return-per-inventory-cycle, treated as the loosely "annualized" ROI in the wireframe.
  const roiPct = inventoryCostCny ? (monthlyNetCny / inventoryCostCny) * 100 : 0;

  // ACOS at which contribution -> 0.
  const breakevenAcosPct = netRevenuePerUnit
    ? ((netRevenuePerUnit - amazonFeePerUnit - landedCostPerUnit) / netRevenuePerUnit) *
      100
    : 0;

  const paybackMonths = monthlyNetCny > 0 ? capitalRequiredCny / monthlyNetCny : Infinity;

  return {
    netRevenuePerUnit,
    amazonFeePerUnit,
    adCostPerUnit,
    landedCostPerUnit,
    contributionPerUnit,
    monthlyRevenueCny,
    monthlyNetCny,
    inventoryCostCny,
    adBudgetCny,
    capitalRequiredCny,
    netMarginPct,
    roiPct,
    breakevenAcosPct,
    paybackMonths,
  };
}

export interface AcosBand {
  estAcosPct: number;
  maxAcceptableAcosPct: number; // breakeven
  safetyPt: number; // headroom
}

export function acosSafety(p: PnlInputs): AcosBand {
  const { breakevenAcosPct } = computePnl(p);
  const maxAcceptableAcosPct = Math.round(breakevenAcosPct);
  return {
    estAcosPct: p.acosPct,
    maxAcceptableAcosPct,
    safetyPt: Math.round(maxAcceptableAcosPct - p.acosPct),
  };
}

/** Net profit (CNY) at a given ACOS, holding everything else constant. */
export function netAtAcos(p: PnlInputs, acosPct: number): number {
  return computePnl({ ...p, acosPct }).monthlyNetCny;
}

export type ScenarioKey = "conservative" | "neutral" | "optimistic";

export interface ScenarioDef {
  key: ScenarioKey;
  label: string;
  labelEn: string;
  probability: number; // 0..1
  unitsFactor: number;
  acosDeltaPt: number;
  cpcUsd: number;
  conversionPct: number;
}

export const SCENARIOS: ScenarioDef[] = [
  {
    key: "conservative",
    label: "保守",
    labelEn: "Conservative",
    probability: 0.25,
    unitsFactor: 0.65,
    acosDeltaPt: 6,
    cpcUsd: 1.45,
    conversionPct: 6,
  },
  {
    key: "neutral",
    label: "中性",
    labelEn: "Neutral",
    probability: 0.5,
    unitsFactor: 1,
    acosDeltaPt: 0,
    cpcUsd: 1.21,
    conversionPct: 8,
  },
  {
    key: "optimistic",
    label: "乐观",
    labelEn: "Optimistic",
    probability: 0.25,
    unitsFactor: 1.55,
    acosDeltaPt: -5,
    cpcUsd: 0.96,
    conversionPct: 11,
  },
];

export interface ScenarioResult extends ScenarioDef {
  monthlyUnits: number;
  acosPct: number;
  monthlyNetCny: number;
  roiPct: number;
}

export function computeScenarios(base: PnlInputs): {
  results: ScenarioResult[];
  weightedRoiPct: number;
  weightedNetCny: number;
} {
  const results = SCENARIOS.map((s) => {
    const monthlyUnits = Math.round(base.monthlyUnits * s.unitsFactor);
    const acosPct = Math.max(1, base.acosPct + s.acosDeltaPt);
    const pnl = computePnl({ ...base, monthlyUnits, acosPct });
    return {
      ...s,
      monthlyUnits,
      acosPct,
      monthlyNetCny: pnl.monthlyNetCny,
      roiPct: pnl.roiPct,
    };
  });
  const weightedRoiPct = results.reduce((a, r) => a + r.roiPct * r.probability, 0);
  const weightedNetCny = results.reduce((a, r) => a + r.monthlyNetCny * r.probability, 0);
  return { results, weightedRoiPct, weightedNetCny };
}
