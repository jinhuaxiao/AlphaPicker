import Link from "next/link";
import { notFound } from "next/navigation";
import { KeyPointList } from "@/components/Card";
import { RadarChart } from "@/components/charts/RadarChart";
import { MetricBar } from "@/components/charts/Bars";
import { getEvaluationByAsin, getSeller, getReviewInsight, pnlInputsFor } from "@/lib/queries";
import { acosSafety } from "@/lib/economics";
import { runAlpha, type DecisionLevel } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { WEIGHTS_BY_EXPERIENCE } from "@/lib/scoring";
import { EXPERIENCE_META } from "@/lib/types";
import { compactNumber, signedPt } from "@/lib/format";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<DecisionLevel, string> = {
  enter_and_scale: "border-green/40 bg-green-soft text-green",
  enter: "border-blue/40 bg-blue-soft text-blue",
  observe_or_micro_test: "border-orange/40 bg-orange-soft text-orange",
  avoid: "border-red/40 bg-red-soft text-red",
};
const indexColor = (i: number) =>
  i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";

export default async function ScorecardPage({
  params,
}: {
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const e = await getEvaluationByAsin(asin);
  const seller = await getSeller();
  if (!e || !seller) notFound();

  const s = e.scores;
  const rawRisk = 100 - s.risk;
  const safety = acosSafety(pnlInputsFor(e)).safetyPt;
  const w = WEIGHTS_BY_EXPERIENCE[seller.experience];

  // One decision number, app-wide: the live opportunity index (same as 机会决策).
  const reviewInsight = e.status !== "draft" ? await getReviewInsight(seller.id, e.asin) : null;
  const vocOverride = reviewInsight?.painPoints.length
    ? toVocPainPoints(reviewInsight.painPoints)
    : undefined;
  const alpha = e.status !== "draft" ? runAlpha(e, seller, [], {}, vocOverride) : null;
  const percentile = alpha ? Math.min(95, Math.max(50, Math.round(alpha.opportunityIndex) - 4)) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {/* radar */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold">五维评分</span>
          <span className="rounded-full border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-muted">辅助 · 参考</span>
        </div>
        <div className="mt-2 flex justify-center">
          <RadarChart
            axes={[
              { label: "需求规模", value: s.demand },
              { label: "竞争(反转)", value: s.competition },
              { label: "利润空间", value: s.profit },
              { label: "差异化", value: s.differentiation },
              { label: "风险(反转)", value: s.risk },
            ]}
          />
        </div>
        <p className="text-center text-[12px] text-muted">
          竞争 / 风险已反转：越大 = 越友好
        </p>
      </div>

      {/* breakdown */}
      <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
        <div className="text-[15px] font-semibold">指标拆解</div>
        <div className="mt-2 divide-y divide-line">
          <MetricBar score={s.demand} title="需求规模" caption={`月搜索 ${compactNumber(e.monthly_search)}`} />
          <MetricBar score={s.competition} title="竞争强度" caption={`Top3 集中 ${e.top3_concentration}%`} tone="orange" />
          <MetricBar score={s.profit} title="利润空间" caption={`毛利率 ${e.gross_margin_pct}%`} tone="green" />
          <MetricBar score={s.differentiation} title="差异化空间" caption="3 大未填补卖点" />
          <MetricBar score={rawRisk} title="风险系数" caption="低风险" tone="green" />
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-[13px] font-medium">
            权重 · {EXPERIENCE_META[seller.experience]}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[12px] text-muted">
            <span>需求 {w.demand}%</span>
            <span>竞争 {w.competition}%</span>
            <span>利润 {w.profit}%</span>
            <span>差异化 {w.differentiation}%</span>
            <span>风险 {w.risk}%</span>
          </div>
        </div>
      </div>

      {/* composite + points */}
      <div className="space-y-4">
        <div className={`rounded-xl border p-5 ${alpha ? LEVEL_TONE[alpha.decision.level] : "border-line bg-panel-2"}`}>
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">机会指数</span>
            {alpha ? (
              <span className="rounded-full border border-current/30 bg-panel/60 px-2 py-0.5 text-[12px] font-medium">
                {alpha.decision.levelLabel}
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-6xl font-bold ${alpha ? indexColor(alpha.opportunityIndex) : "text-muted"}`}>
              {alpha ? alpha.opportunityIndex : "—"}
            </span>
            <span className="font-mono text-lg opacity-60">/100</span>
          </div>
          {alpha ? (
            <div className="mt-2 text-[13px]">
              超过类目同档 <span className="font-semibold">{percentile}%</span> 候选 · 经典综合分{" "}
              <span className="font-mono">{e.composite}</span>（辅助）
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-card">
          <div className="text-[15px] font-semibold">关键要点</div>
          <div className="mt-2">
            <KeyPointList
              points={[
                {
                  icon: s.demand >= 70 ? "ok" : "warn",
                  text: s.demand >= 70 ? "需求稳定 · 12 月内 +18%" : "需求偏弱 · 关注季节性",
                },
                {
                  icon: e.top3_concentration >= 60 ? "warn" : "ok",
                  text: `竞争${e.top3_concentration >= 60 ? "集中" : "分散"} · 头部 3 家占 ${e.top3_concentration}% 流量`,
                },
                {
                  icon: safety >= 0 ? "ok" : "warn",
                  text: `ACOS 安全边际 ${signedPt(safety)}`,
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Link
            href={`/evaluations/${asin}/report`}
            className="block rounded-lg bg-blue px-5 py-2.5 text-center text-[14px] font-medium text-white transition hover:bg-blue-strong"
          >
            查看决策报告
          </Link>
          <Link
            href={`/evaluations/${asin}/simulator`}
            className="block rounded-lg border border-line bg-panel px-5 py-2.5 text-center text-[14px] font-medium transition hover:bg-panel-2"
          >
            进入盈亏模拟器
          </Link>
        </div>
      </div>
    </div>
  );
}
