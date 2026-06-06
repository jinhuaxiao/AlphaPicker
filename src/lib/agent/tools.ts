// Real AlphaPilot tools. Each is backed by the same engines the rest of the app
// uses (recommend → Sorftime + runAlpha, economics, alpha decision, VOC), so the
// agent reasons over live data instead of scripted scenarios.
//
// Tool `details` carry structured payloads the UI renders (candidate cards,
// formula breakdown, sim tables); `content` is the compact text the model reads.

import { Type } from "@earendil-works/pi-ai";
import type { AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import {
  getSeller,
  getEvaluations,
  getEvaluationByAsin,
  getKeywords,
  getReviewInsight,
} from "@/lib/queries";
import { recommendForSeller } from "@/lib/recommend";
import { runAlpha, buildSellerPolicy } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { computePnl } from "@/lib/economics";
import type { Evaluation, Seller } from "@/lib/types";

function text(s: string): AgentToolResult<unknown>["content"] {
  return [{ type: "text", text: s }];
}

function fmtCny(n: number): string {
  return `¥${Math.round(n).toLocaleString()}`;
}

async function requireSeller(): Promise<Seller> {
  const seller = await getSeller();
  if (!seller) throw new Error("未找到卖家画像，请先完成卖家画像引导。");
  return seller;
}

async function loadEval(asin: string): Promise<{ seller: Seller; evaluation: Evaluation }> {
  const seller = await requireSeller();
  const evaluation = await getEvaluationByAsin(asin);
  if (!evaluation) throw new Error(`未找到 ASIN ${asin} 的评估，它可能还没加入评估库。`);
  return { seller, evaluation };
}

/* ───────────────────────── 画像 · seller profile ───────────────────────── */

const emptySchema = Type.Object({});

const getSellerProfile: AgentTool<typeof emptySchema> = {
  name: "get_seller_profile",
  label: "读取卖家画像",
  description:
    "读取当前卖家的画像与选品策略（经验、类目、单品预算、风险偏好），以及由画像推导出的硬门槛（最低月搜索、最低 TACOS 安全边际、目标净利率、最大测试预算占比）。在按画像筛品或判断是否适配时先调用。",
  parameters: emptySchema,
  async execute() {
    const seller = await requireSeller();
    const policy = buildSellerPolicy(seller);
    const details = { seller, policy };
    const summary = [
      `卖家：${seller.name} · ${seller.plan}`,
      `经验：${seller.experience} · 类目：${seller.categories.join("/") || "未设置"}`,
      `单品预算：${fmtCny(seller.per_product_budget_cny)} · 风险偏好：${seller.risk_preference}/100`,
      `策略门槛：最低月搜索 ${policy.minMonthlySearch.toLocaleString()} · 目标 TACOS 后净利率 ${policy.targetNetMarginPct}% · 最低 TACOS 安全边际 ${policy.minTacosSafetyPt}pt · 最大测试预算占比 ${Math.round(policy.maxTestBudgetRatio * 100)}%`,
    ].join("\n");
    return { content: text(summary), details };
  },
};

/* ─────────────────── Sorftime + 算法 · recommend products ─────────────────── */

const recommendSchema = Type.Object({
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 8, description: "返回候选数量，默认 3" }),
  ),
  variety: Type.Optional(
    Type.Integer({ minimum: 0, description: "换一批的种子，递增即换不同 SKU，默认 0" }),
  ),
  min_margin_pct: Type.Optional(
    Type.Number({ description: "过滤 TACOS 后净利率下限（%），如 30 表示只要 ≥30%" }),
  ),
});

const recommendProducts: AgentTool<typeof recommendSchema> = {
  name: "recommend_products",
  label: "拉取并评分候选品",
  description:
    "按卖家画像（类目 + 预算价位带）从 Amazon 实时拉取在售真实候选品，对每个候选跑完整决策算法，按机会指数排序返回。用于『帮我找 N 个低竞争/高利润的品』『换一批候选』。可用 variety 换一批。",
  parameters: recommendSchema,
  async execute(_id, params) {
    const seller = await requireSeller();
    const limit = params.limit ?? 3;
    const variety = params.variety ?? 0;
    const all = await recommendForSeller(seller, 8, variety);
    const filtered =
      params.min_margin_pct != null
        ? all.filter((r) => r.netMarginAfterTacosPct >= params.min_margin_pct!)
        : all;
    const items = filtered.slice(0, limit);
    if (!items.length) {
      return {
        content: text("本批没有满足条件的候选，可放宽利润门槛或用更大的 variety 换一批。"),
        details: { items: [] },
      };
    }
    const lines = items.map(
      (r, i) =>
        `${i + 1}. ${r.name} (${r.asin}) — 机会指数 ${r.opportunityIndex} · ${r.levelLabel} · $${r.price} · 月销 ${r.monthlyUnits.toLocaleString()} · TACOS后净利 ${r.netMarginAfterTacosPct}% · Top3集中度 ${r.top3Concentration}% · 硬门槛${r.gatePass ? "全过" : "未过"}`,
    );
    return {
      content: text(`按机会指数排序的 ${items.length} 个真实在售候选：\n${lines.join("\n")}`),
      details: { items },
    };
  },
};

/* ───────────────────────── 算法 · full evaluation ───────────────────────── */

const asinSchema = Type.Object({
  asin: Type.String({ description: "目标产品的 ASIN" }),
});

const getEvaluation: AgentTool<typeof asinSchema> = {
  name: "get_evaluation",
  label: "读取决策报告",
  description:
    "读取某个已加入评估库的 ASIN 的完整决策报告：机会指数、硬门槛、TACOS 财务底座、市场机会、VOC 痛点、决策等级与建议、止损规则、竞品动态预案。用于解释『为什么是 X 分』『这个品该不该进』。",
  parameters: asinSchema,
  async execute(_id, params) {
    const { seller, evaluation } = await loadEval(params.asin);
    const keywords = await getKeywords(evaluation.id);
    const review = await getReviewInsight(seller.id, evaluation.asin);
    const vocOverride = review?.painPoints?.length ? toVocPainPoints(review.painPoints) : undefined;
    const a = runAlpha(evaluation, seller, keywords, {}, vocOverride);
    const m = a.multipliers;
    const summary = [
      `${evaluation.name} (${evaluation.asin})`,
      `机会指数 ${a.opportunityIndex} · ${a.decision.levelLabel} · 硬门槛${a.gatePass ? "全过" : "未过"}`,
      `构成：市场基分 ${a.baseScore} × 利润 ${m.profitMultiplier} × 风险 ${m.riskMultiplier} × 适配 ${m.sellerFitMultiplier} × VOC ${m.vocFactor}`,
      `财务：毛利率 ${a.finance.grossMarginPct}% · 预估TACOS ${a.finance.estTacosPct}% · 可承受TACOS ${a.finance.maxAcceptableTacosPct}% · 安全边际 ${a.finance.tacosSafetyPt}pt · TACOS后净利率 ${a.finance.netMarginAfterTacosPct}% · 月净利 ${fmtCny(a.finance.monthlyNetCny)} · 资金需求 ${fmtCny(a.finance.capitalRequiredCny)}`,
      `市场：月搜索 ${a.market.monthlySearch.toLocaleString()} · 需求分 ${a.market.demandScore} · Top3集中度 ${a.market.top3Concentration}% · 长尾空间 ${a.market.longTailRoomPct}% · 加权CPC $${a.market.weightedCpc}`,
      `VOC：${a.voc.map((v) => `${v.point}(${v.severity}${v.supplierSolvable ? "·已确认" : "·待确认"})`).join("、") || "无"}`,
      `决策：${a.decision.recommendation}`,
      `止损：${a.decision.stopLossRules.join("；")}`,
    ].join("\n");
    return { content: text(summary), details: { evaluation, alpha: a } };
  },
};

/* ─────────────────── TACOS · simulate economics / what-if ─────────────────── */

const simulateSchema = Type.Object({
  asin: Type.String({ description: "目标产品的 ASIN" }),
  cost_cny: Type.Optional(Type.Number({ description: "假设采购成本（人民币/件）" })),
  price_usd: Type.Optional(Type.Number({ description: "假设售价（美元）" })),
  est_acos_pct: Type.Optional(Type.Number({ description: "假设 ACOS（%）" })),
  monthly_units: Type.Optional(Type.Number({ description: "假设月销量（件）" })),
});

const simulateEconomics: AgentTool<typeof simulateSchema> = {
  name: "simulate_economics",
  label: "盈亏模拟（what-if）",
  description:
    "对某个 ASIN 做 what-if 模拟：在采购成本 / 售价 / ACOS / 月销量上施加假设，重算单位经济、TACOS 后净利率、机会指数与决策等级，并与当前基线对比。用于『把采购成本压到 ¥38 结论会变吗』这类推演。",
  parameters: simulateSchema,
  async execute(_id, params) {
    const { seller, evaluation } = await loadEval(params.asin);
    const keywords = await getKeywords(evaluation.id);
    const base = runAlpha(evaluation, seller, keywords);

    const next: Evaluation = {
      ...evaluation,
      cost_cny: params.cost_cny ?? evaluation.cost_cny,
      price_usd: params.price_usd ?? evaluation.price_usd,
      est_acos_pct: params.est_acos_pct ?? evaluation.est_acos_pct,
      target_monthly_units: params.monthly_units ?? evaluation.target_monthly_units,
    };
    // gross margin moves with cost/price, so recompute it before re-scoring.
    const FX = 7.2;
    const amazonFeeUsd = next.price_usd * (next.commission_pct / 100) + next.fba_fee_usd;
    const landedUsd = (next.cost_cny + next.freight_cny) / FX;
    next.gross_margin_pct = next.price_usd
      ? Math.round(((next.price_usd - amazonFeeUsd - landedUsd) / next.price_usd) * 100)
      : 0;

    const sim = runAlpha(next, seller, keywords);
    const pnl = computePnl({
      priceUsd: next.price_usd,
      costCny: next.cost_cny,
      freightCny: next.freight_cny,
      fbaFeeUsd: next.fba_fee_usd,
      commissionPct: next.commission_pct,
      couponPct: next.coupon_pct,
      returnRatePct: next.return_rate_pct,
      monthlyUnits: next.target_monthly_units || 1,
      acosPct: next.est_acos_pct,
    });

    const changes: string[] = [];
    if (params.cost_cny != null) changes.push(`采购成本 ${fmtCny(evaluation.cost_cny)}→${fmtCny(next.cost_cny)}`);
    if (params.price_usd != null) changes.push(`售价 $${evaluation.price_usd}→$${next.price_usd}`);
    if (params.est_acos_pct != null) changes.push(`ACOS ${evaluation.est_acos_pct}%→${next.est_acos_pct}%`);
    if (params.monthly_units != null) changes.push(`月销 ${evaluation.target_monthly_units}→${next.target_monthly_units}`);

    const deltas = {
      grossMargin: { from: base.finance.grossMarginPct, to: sim.finance.grossMarginPct },
      netAfterTacos: { from: base.finance.netMarginAfterTacosPct, to: sim.finance.netMarginAfterTacosPct },
      tacosSafety: { from: base.finance.tacosSafetyPt, to: sim.finance.tacosSafetyPt },
      monthlyNetCny: { from: base.finance.monthlyNetCny, to: sim.finance.monthlyNetCny },
      opportunityIndex: { from: base.opportunityIndex, to: sim.opportunityIndex },
      level: { from: base.decision.levelLabel, to: sim.decision.levelLabel },
    };
    const summary = [
      `模拟假设：${changes.join("、") || "无变更"}`,
      `毛利率 ${deltas.grossMargin.from}% → ${deltas.grossMargin.to}%`,
      `TACOS后净利率 ${deltas.netAfterTacos.from}% → ${deltas.netAfterTacos.to}%`,
      `TACOS安全边际 ${deltas.tacosSafety.from}pt → ${deltas.tacosSafety.to}pt`,
      `月净利 ${fmtCny(deltas.monthlyNetCny.from)} → ${fmtCny(deltas.monthlyNetCny.to)}`,
      `机会指数 ${deltas.opportunityIndex.from} → ${deltas.opportunityIndex.to}`,
      `决策 ${deltas.level.from} → ${deltas.level.to}`,
    ].join("\n");
    return { content: text(summary), details: { changes, deltas, base, sim, pnl } };
  },
};

/* ───────────────────────── VOC · review pain points ───────────────────────── */

const getVocPainPoints: AgentTool<typeof asinSchema> = {
  name: "get_voc_painpoints",
  label: "读取 VOC 痛点",
  description:
    "读取某个 ASIN 的 VOC 差评痛点聚类（真实差评数据优先，缺失时回退到同类差评模式），含严重度与供应商可解决状态。用于解释 VOC 系数为何拖累机会指数、以及确认痛点后能回升多少。",
  parameters: asinSchema,
  async execute(_id, params) {
    const { seller, evaluation } = await loadEval(params.asin);
    const keywords = await getKeywords(evaluation.id);
    const review = await getReviewInsight(seller.id, evaluation.asin);
    const vocOverride = review?.painPoints?.length ? toVocPainPoints(review.painPoints) : undefined;
    const a = runAlpha(evaluation, seller, keywords, {}, vocOverride);
    const lines = a.voc.map(
      (v) =>
        `· [${v.severity}] ${v.point} — ${v.supplierSolvable ? `已确认:${v.supplierSolvable}` : "待确认"}（${v.evidence}）`,
    );
    const head = review
      ? `真实差评：${review.reviewCount} 条，差评率 ${review.negRatioPct}%，平均 ${review.avgStar} 星`
      : "暂无抓取到的真实差评，下为同类差评模式推断";
    return {
      content: text(`${head}\nVOC 系数 ${a.multipliers.vocFactor}（确认可解决可回升至 1.0）：\n${lines.join("\n") || "无痛点"}`),
      details: { review, voc: a.voc, vocFactor: a.multipliers.vocFactor },
    };
  },
};

/* ──────────────────────── list saved evaluations ──────────────────────── */

const listEvaluations: AgentTool<typeof emptySchema> = {
  name: "list_my_evaluations",
  label: "列出我的评估",
  description:
    "列出卖家已加入评估库的所有产品及其机会指数与决策状态。用于『我的选品里哪个最值得做』『对比我评估过的品』。",
  parameters: emptySchema,
  async execute() {
    const seller = await requireSeller();
    const evals = await getEvaluations(seller.id);
    if (!evals.length) return { content: text("评估库还是空的。"), details: { items: [] } };
    const lines = evals.map(
      (e) => `· ${e.name} (${e.asin}) — 综合 ${e.composite} · ${e.status} · $${e.price_usd} · 毛利率 ${e.gross_margin_pct}%`,
    );
    return {
      content: text(`评估库共 ${evals.length} 个产品：\n${lines.join("\n")}`),
      details: {
        items: evals.map((e) => ({
          asin: e.asin,
          name: e.name,
          composite: e.composite,
          status: e.status,
          price: e.price_usd,
        })),
      },
    };
  },
};

export const agentTools: AgentTool<any>[] = [
  getSellerProfile,
  recommendProducts,
  getEvaluation,
  simulateEconomics,
  getVocPainPoints,
  listEvaluations,
];
