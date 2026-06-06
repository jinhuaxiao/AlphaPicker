// AlphaPicker decision algorithm (v2).
//
// Replaces the naive 5-dimension weighted score with:
//   hard gates → TACOS financial base → market opportunity score
//   → profit / risk / seller-fit multipliers → VOC human-in-loop confirmation
//   → opportunity index → decision + dynamic warnings.
//
// Pure TS (no DB / no server-only deps) so the UI can recompute live as the
// seller confirms VOC pain points.

import { computePnl, type PnlInputs } from "./economics";
import type { Evaluation, Keyword, Seller, ExperienceLevel } from "./types";

const round = (n: number, d = 0) => Math.round(n * 10 ** d) / 10 ** d;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/* ───────────────────────── 1 · seller policy ───────────────────────── */

export interface SellerPolicy {
  experience: ExperienceLevel;
  targetNetMarginPct: number; // min net margin after TACOS to leave on the table
  minTacosSafetyPt: number; // gate on ACOS/TACOS headroom
  minMonthlySearch: number; // demand hard gate
  riskTolerance: number; // 0 (保守) .. 1 (激进)
  maxTestBudgetRatio: number; // share of budget allowed for a first test
  budgetCny: number;
  categories: string[];
}

export function buildSellerPolicy(seller: Seller): SellerPolicy {
  const risk = clamp((seller.risk_preference ?? 30) / 100, 0, 1);
  const base =
    seller.experience === "novice"
      ? { margin: 12, safety: 5, search: 8000, ratio: 0.2 }
      : seller.experience === "intermediate"
        ? { margin: 10, safety: 3, search: 5000, ratio: 0.3 }
        : { margin: 8, safety: 2, search: 3000, ratio: 0.4 };
  // A more aggressive seller tolerates thinner safety.
  return {
    experience: seller.experience,
    targetNetMarginPct: round(base.margin - risk * 3, 1),
    minTacosSafetyPt: round(base.safety - risk * 2, 1),
    minMonthlySearch: base.search,
    riskTolerance: risk,
    maxTestBudgetRatio: base.ratio,
    budgetCny: seller.per_product_budget_cny || 40000,
    categories: seller.categories ?? [],
  };
}

/* ─────────────────── 2 · blended finance with TACOS ─────────────────── */

export interface FinanceBase {
  grossMarginPct: number; // pre-ad, after product cost + FBA + commission
  paidSalesSharePct: number; // share of orders that are ad-driven
  estTacosPct: number; // total ACOS = ad spend / total revenue
  maxAcceptableTacosPct: number;
  tacosSafetyPt: number;
  netMarginAfterTacosPct: number;
  monthlyNetCny: number;
  capitalRequiredCny: number;
  roiPct: number;
  passesFinanceGate: boolean;
}

function pnlInputs(e: Evaluation): PnlInputs {
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

export function calculateBlendedFinanceWithTacos(
  e: Evaluation,
  policy: SellerPolicy,
): FinanceBase {
  const pnl = computePnl(pnlInputs(e));
  // Heavier head concentration ⇒ more orders must be bought with ads.
  const paidShare = clamp(0.3 + e.top3_concentration / 200, 0.3, 0.7);
  const estTacos = round(e.est_acos_pct * paidShare, 1);
  // Headroom: gross margin must cover TACOS and still leave the target margin.
  const maxAcceptableTacos = round(e.gross_margin_pct - policy.targetNetMarginPct, 1);
  const tacosSafetyPt = round(maxAcceptableTacos - estTacos, 1);
  const netMarginAfterTacos = round(e.gross_margin_pct - estTacos, 1);

  return {
    grossMarginPct: e.gross_margin_pct,
    paidSalesSharePct: round(paidShare * 100),
    estTacosPct: estTacos,
    maxAcceptableTacosPct: Math.max(0, maxAcceptableTacos),
    tacosSafetyPt,
    netMarginAfterTacosPct: netMarginAfterTacos,
    monthlyNetCny: Math.round(pnl.monthlyNetCny),
    capitalRequiredCny: Math.round(pnl.capitalRequiredCny),
    roiPct: round(pnl.roiPct),
    passesFinanceGate: netMarginAfterTacos > 0,
  };
}

/* ───────────────────── 3 · market opportunity ──────────────────────── */

export interface MarketOpportunity {
  monthlySearch: number;
  demandScore: number;
  top3Concentration: number;
  longTailRoomPct: number;
  weightedCpc: number;
  marketScore: number;
  passesDemandGate: boolean;
}

export function analyzeMarketOpportunity(
  e: Evaluation,
  keywords: Keyword[],
  policy: SellerPolicy,
): MarketOpportunity {
  const demandScore = clamp(
    Math.round((Math.log10(Math.max(e.monthly_search, 1)) / Math.log10(50000)) * 100),
    0,
    100,
  );
  // Long-tail room = traffic not locked up by the concentrated head.
  const longTailRoom = clamp(round(100 - e.top3_concentration), 0, 100);
  void keywords;
  const concScore = clamp(round(100 - (e.top3_concentration - 20) * 1.25), 0, 100);
  const marketScore = clamp(
    Math.round(demandScore * 0.5 + concScore * 0.3 + longTailRoom * 0.2),
    0,
    100,
  );
  return {
    monthlySearch: e.monthly_search,
    demandScore,
    top3Concentration: e.top3_concentration,
    longTailRoomPct: longTailRoom,
    weightedCpc: e.weighted_cpc,
    marketScore,
    passesDemandGate: e.monthly_search >= policy.minMonthlySearch,
  };
}

/* ───────────────── 4 · VOC pain points (AI-suggested) ───────────────── */

export type Severity = "high" | "mid" | "low";
export type Solvable = "solvable" | "unsolvable" | null;

export interface VocPainPoint {
  id: string;
  point: string;
  severity: Severity;
  evidence: string;
  supplierSolvable: Solvable;
}

const VOC_MAP: { match: RegExp; points: { point: string; severity: Severity }[] }[] = [
  { match: /bowl|feeder|dish/i, points: [
    { point: "防滑底座易滑动", severity: "high" },
    { point: "缝隙不易清洗", severity: "mid" },
    { point: "容量与描述不符", severity: "low" },
  ] },
  { match: /garlic|press|mincer|crusher/i, points: [
    { point: "按压费力、手感差", severity: "high" },
    { point: "蒜泥残留难清理", severity: "mid" },
    { point: "材质易变形/生锈", severity: "mid" },
  ] },
  { match: /organizer|drawer|storage|divider/i, points: [
    { point: "尺寸与抽屉不匹配", severity: "high" },
    { point: "材质偏薄、廉价感", severity: "mid" },
  ] },
  { match: /roller|lint/i, points: [
    { point: "粘性/吸附力不足", severity: "high" },
    { point: "重复使用清理麻烦", severity: "mid" },
  ] },
  { match: /bottle|tumbler|flask|cup/i, points: [
    { point: "密封性差、易漏水", severity: "high" },
    { point: "保温时长不达标", severity: "mid" },
    { point: "初期有塑料异味", severity: "low" },
  ] },
  { match: /cable|cord|sleeve|wire/i, points: [
    { point: "长度/直径与线材不匹配", severity: "high" },
    { point: "拉链/魔术贴易损坏", severity: "mid" },
  ] },
];

export function extractVocPainPointsWithAI(
  e: Evaluation,
  confirmations: Record<string, Solvable> = {},
): VocPainPoint[] {
  const hay = `${e.name} ${e.category_path} ${e.main_keyword}`;
  const hit = VOC_MAP.find((m) => m.match.test(hay));
  const points = hit?.points ?? [
    { point: "做工/质量一致性问题", severity: "mid" as Severity },
    { point: "实物与图片描述不符", severity: "low" as Severity },
  ];
  return points.map((p, i) => {
    const id = `voc${i + 1}`;
    return {
      id,
      point: p.point,
      severity: p.severity,
      evidence: "AI 从同类差评高频词聚类得出（待卖家与供应商确认）",
      supplierSolvable: confirmations[id] ?? null,
    };
  });
}

/* ───────────── 5 · collect seller confirmation for VOC ──────────────── */

export function collectSellerConfirmationForVoc(
  painPoints: VocPainPoint[],
  confirmations: Record<string, Solvable>,
): VocPainPoint[] {
  return painPoints.map((p) => ({ ...p, supplierSolvable: confirmations[p.id] ?? p.supplierSolvable }));
}

/* ─────────────────── 6 · opportunity index ─────────────────────────── */

export interface Multipliers {
  profitMultiplier: number;
  riskMultiplier: number;
  sellerFitMultiplier: number;
  vocFactor: number;
}

export interface HardGate {
  key: string;
  label: string;
  pass: boolean;
  detail: string;
}

const CAT_TOKENS: Record<string, RegExp> = {
  宠物: /pet|dog|cat|animal/i,
  厨房: /kitchen|garlic|cook|bar|dining/i,
  收纳: /organizer|storage|drawer|divider|closet/i,
  家居: /home|garden|house|decor|lighting|bath/i,
  小家电: /appliance|humidifier|fan|electric/i,
};

export interface OpportunityResult {
  hardGates: HardGate[];
  gatePass: boolean;
  multipliers: Multipliers;
  baseScore: number;
  opportunityIndex: number;
}

export function calculateOpportunityIndex(
  market: MarketOpportunity,
  finance: FinanceBase,
  policy: SellerPolicy,
  voc: VocPainPoint[],
  categoryPath: string,
): OpportunityResult {
  const hardGates: HardGate[] = [
    {
      key: "demand",
      label: "市场需求门槛",
      pass: market.passesDemandGate,
      detail: `月搜索 ${market.monthlySearch.toLocaleString()} ${market.passesDemandGate ? "≥" : "<"} 门槛 ${policy.minMonthlySearch.toLocaleString()}`,
    },
    {
      key: "finance",
      label: "TACOS 后盈利门槛",
      pass: finance.passesFinanceGate,
      detail: `TACOS 后净利率 ${finance.netMarginAfterTacosPct}% ${finance.passesFinanceGate ? "> 0" : "≤ 0"}`,
    },
    {
      key: "concentration",
      label: "垄断风险门槛",
      pass: market.top3Concentration <= 80,
      detail: `Top3 集中度 ${market.top3Concentration}% ${market.top3Concentration <= 80 ? "≤" : ">"} 80%`,
    },
  ];
  const gatePass = hardGates.every((g) => g.pass);

  const baseScore = market.marketScore;

  // profit: thicker net-after-TACOS margin lifts the index.
  const profitMultiplier = round(clamp(0.72 + finance.netMarginAfterTacosPct / 60, 0.72, 1.08), 2);

  // risk: TACOS safety + low concentration, modulated by the seller's tolerance.
  const riskRaw = 0.74 + finance.tacosSafetyPt / 45 + (50 - market.top3Concentration) / 180;
  const riskMultiplier = round(clamp(riskRaw * (0.92 + policy.riskTolerance * 0.16), 0.65, 1.08), 2);

  // seller fit: category match + capital fit vs budget.
  const catHit = policy.categories.some((c) => CAT_TOKENS[c]?.test(categoryPath));
  const catFit = catHit ? 1.05 : 0.95;
  const budgetFit = finance.capitalRequiredCny <= policy.budgetCny ? 1.0 : clamp(policy.budgetCny / finance.capitalRequiredCny, 0.7, 1);
  const sellerFitMultiplier = round(clamp(catFit * budgetFit, 0.75, 1.1), 2);

  // VOC: unconfirmed high-severity + supplier-unsolvable pain points add uncertainty.
  const unconfirmedHigh = voc.filter((v) => v.supplierSolvable == null && v.severity === "high").length;
  const unsolvable = voc.filter((v) => v.supplierSolvable === "unsolvable").length;
  const vocFactor = round(clamp(1 - unconfirmedHigh * 0.06 - unsolvable * 0.12, 0.55, 1), 2);

  // Structural score (market × profit × risk × fit) is clamped first, then the
  // VOC factor is applied — so confirming pain points visibly moves the index
  // instead of being masked by the 100 cap.
  const structural = clamp(baseScore * profitMultiplier * riskMultiplier * sellerFitMultiplier, 0, 100);
  let index = structural * vocFactor;
  if (!gatePass) index = Math.min(index, 38); // a failed hard gate caps the index
  index = round(clamp(index, 0, 100), 1);

  return {
    hardGates,
    gatePass,
    baseScore,
    multipliers: { profitMultiplier, riskMultiplier, sellerFitMultiplier, vocFactor },
    opportunityIndex: index,
  };
}

/* ───────────── 7 · decision + dynamic warnings ─────────────────────── */

export type DecisionLevel = "enter_and_scale" | "enter" | "observe_or_micro_test" | "avoid";

export interface BudgetPolicy {
  maxTestBudgetRatio: number;
  suggestedInitialBudget: number;
  suggestedFirstBatch: string;
}

export interface DynamicWarning {
  trigger: string;
  impact: string;
  responsePlan: string;
}

export interface Decision {
  level: DecisionLevel;
  levelLabel: string;
  recommendation: string;
  reasoning: string[];
  budgetPolicy: BudgetPolicy;
  keywordStrategy: string;
  stopLossRules: string[];
}

const LEVEL_LABEL: Record<DecisionLevel, string> = {
  enter_and_scale: "建议进入 · 可正常仓位",
  enter: "建议进入 · 标准测试",
  observe_or_micro_test: "观望 / 小批量测试",
  avoid: "不建议进入",
};

export function generateDecisionAndWarnings(
  opportunity: OpportunityResult,
  finance: FinanceBase,
  market: MarketOpportunity,
  policy: SellerPolicy,
  voc: VocPainPoint[],
): { decision: Decision; dynamicWarnings: DynamicWarning[] } {
  const idx = opportunity.opportunityIndex;
  let level: DecisionLevel;
  if (!opportunity.gatePass) level = "avoid";
  else if (idx >= 75) level = "enter_and_scale";
  else if (idx >= 62) level = "enter";
  else if (idx >= 45) level = "observe_or_micro_test";
  else level = "avoid";

  const recommendation =
    level === "enter_and_scale"
      ? "市场、财务、卖家适配三项均过关，可按正常仓位进入。"
      : level === "enter"
        ? "整体成立，按标准测试仓位进入并观察前 2 周表现。"
        : level === "observe_or_micro_test"
          ? "谨慎小批量测试，不建议直接重仓。"
          : "硬性门槛或盈利结构不成立，不建议占用备货资金。";

  const reasoning: string[] = [];
  reasoning.push(
    market.passesDemandGate
      ? `市场需求成立（月搜索 ${market.monthlySearch.toLocaleString()}）${market.top3Concentration >= 55 ? "，但 Top3 集中度较高" : "，竞争相对分散"}`
      : `市场需求不足（月搜索 ${market.monthlySearch.toLocaleString()} 低于门槛）`,
  );
  reasoning.push(
    finance.passesFinanceGate
      ? `TACOS 后利润为正（净利率 ${finance.netMarginAfterTacosPct}%），安全边际 ${finance.tacosSafetyPt}pt`
      : `TACOS 后利润为负（净利率 ${finance.netMarginAfterTacosPct}%），盈利结构不成立`,
  );
  reasoning.push(
    market.longTailRoomPct >= 30
      ? `长尾词仍有切入空间（长尾占比 ${market.longTailRoomPct}%）`
      : `长尾空间有限（${market.longTailRoomPct}%），需正面竞争核心词`,
  );
  const pendingVoc = voc.filter((v) => v.supplierSolvable == null);
  if (pendingVoc.length) {
    reasoning.push(
      `VOC 中存在「${pendingVoc.map((v) => v.point).slice(0, 2).join("、")}」等痛点，需卖家确认供应商是否能解决`,
    );
  } else if (voc.some((v) => v.supplierSolvable === "unsolvable")) {
    reasoning.push("部分核心痛点供应商无法解决，差异化与退货风险偏高");
  } else if (voc.length) {
    reasoning.push("VOC 痛点已确认供应商可解决，可作为差异化卖点");
  }

  const firstBatch =
    level === "enter_and_scale" ? "300-500 units" : level === "enter" ? "200-400 units" : level === "observe_or_micro_test" ? "100-300 units" : "暂不下单";
  const budgetPolicy: BudgetPolicy = {
    maxTestBudgetRatio: policy.maxTestBudgetRatio,
    suggestedInitialBudget: Math.round(policy.budgetCny * policy.maxTestBudgetRatio),
    suggestedFirstBatch: firstBatch,
  };

  const keywordStrategy =
    market.top3Concentration >= 55
      ? "优先长尾词切入，避免硬抢主关键词"
      : "主词 + 长尾词组合推进，逐步抢占核心词排名";

  const tacosStop = Math.max(8, Math.round(finance.maxAcceptableTacosPct));
  const stopLossRules = [
    `TACOS 超过 ${tacosStop}% 且连续 7 天无改善，停止加仓`,
    "退货率超过 8%，暂停补货",
    "核心词 CPC 上涨超过 20%，降低主词预算",
    "前 10 条评论低于 4.0 星，暂停扩量",
  ];

  const dynamicWarnings: DynamicWarning[] = [
    {
      trigger: "Top1 竞品上线 20% coupon",
      impact:
        finance.tacosSafetyPt < 6
          ? "若跟进同等折扣，TACOS 安全边际可能转负"
          : "跟进折扣后利润收窄，但仍在安全区",
      responsePlan: "不建议直接打价格战，优先转向长尾词与差异化卖点",
    },
    {
      trigger: "加权 CPC 上涨 20%",
      impact: "广告成本可能突破目标 TACOS 上限",
      responsePlan: "降低主词预算，保留低 CPC 长尾词测试",
    },
  ];
  if (market.top3Concentration >= 60) {
    dynamicWarnings.push({
      trigger: "头部卖家加大广告投放",
      impact: "核心词曝光进一步被挤压",
      responsePlan: "聚焦细分场景关键词，建立小而精的认知",
    });
  }

  return {
    decision: { level, levelLabel: LEVEL_LABEL[level], recommendation, reasoning, budgetPolicy, keywordStrategy, stopLossRules },
    dynamicWarnings,
  };
}

/* ───────────────────────── orchestrator ────────────────────────────── */

export interface AlphaResult {
  policy: SellerPolicy;
  finance: FinanceBase;
  market: MarketOpportunity;
  voc: VocPainPoint[];
  hardGates: HardGate[];
  gatePass: boolean;
  multipliers: Multipliers;
  baseScore: number;
  opportunityIndex: number;
  decision: Decision;
  dynamicWarnings: DynamicWarning[];
}

export function runAlpha(
  e: Evaluation,
  seller: Seller,
  keywords: Keyword[],
  confirmations: Record<string, Solvable> = {},
): AlphaResult {
  const policy = buildSellerPolicy(seller);
  const finance = calculateBlendedFinanceWithTacos(e, policy);
  const market = analyzeMarketOpportunity(e, keywords, policy);
  const voc = collectSellerConfirmationForVoc(
    extractVocPainPointsWithAI(e),
    confirmations,
  );
  const opp = calculateOpportunityIndex(market, finance, policy, voc, e.category_path);
  const { decision, dynamicWarnings } = generateDecisionAndWarnings(opp, finance, market, policy, voc);

  return {
    policy,
    finance,
    market,
    voc,
    hardGates: opp.hardGates,
    gatePass: opp.gatePass,
    multipliers: opp.multipliers,
    baseScore: opp.baseScore,
    opportunityIndex: opp.opportunityIndex,
    decision,
    dynamicWarnings,
  };
}
