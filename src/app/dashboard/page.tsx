import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stat } from "@/components/Card";
import { EvaluationTable, type EvaluationRow, type RowKind } from "@/components/EvaluationTable";
import { getSeller, getEvaluations, getReviewInsight, pnlInputsFor } from "@/lib/queries";
import { acosSafety } from "@/lib/economics";
import { runAlpha, type DecisionLevel } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { cny } from "@/lib/format";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<DecisionLevel, string> = {
  enter_and_scale: "border-green/40 bg-green-soft text-green",
  enter: "border-blue/40 bg-blue-soft text-blue",
  observe_or_micro_test: "border-orange/40 bg-orange-soft text-orange",
  avoid: "border-red/40 bg-red-soft text-red",
};
const isRecommend = (l: DecisionLevel) => l === "enter_and_scale" || l === "enter";
const rowKind = (l: DecisionLevel): RowKind =>
  isRecommend(l) ? "recommend" : l === "observe_or_micro_test" ? "watch" : "avoid";

export default async function DashboardPage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");
  const evals = await getEvaluations(seller.id);

  // One source of truth — the v2 opportunity algorithm with the same review VOC
  // inputs as the decision page — across the whole app.
  const insights = await Promise.all(
    evals.map((e) => (e.status === "draft" ? null : getReviewInsight(seller.id, e.asin))),
  );
  const rows = evals.map((e, i) => {
    const ri = insights[i];
    const vocOverride = ri?.painPoints.length ? toVocPainPoints(ri.painPoints) : undefined;
    return {
      e,
      alpha: e.status === "draft" ? null : runAlpha(e, seller, [], {}, vocOverride),
      safety: e.status === "draft" ? null : acosSafety(pnlInputsFor(e)).safetyPt,
    };
  });
  const scored = rows.filter((r) => r.alpha);
  const recommend = scored.filter((r) => isRecommend(r.alpha!.decision.level)).length;
  const watch = scored.filter((r) => r.alpha!.decision.level === "observe_or_micro_test").length;
  const avoid = scored.filter((r) => r.alpha!.decision.level === "avoid").length;
  const drafts = rows.length - scored.length;

  const avgIndex = scored.length
    ? Math.round(scored.reduce((a, r) => a + r.alpha!.opportunityIndex, 0) / scored.length)
    : 0;
  const hitRate = scored.length
    ? Math.round(((recommend + watch) / scored.length) * 100)
    : 0;
  const avoided = scored
    .filter((r) => r.alpha!.decision.level === "avoid")
    .reduce((a, r) => a + r.e.target_monthly_units * (r.e.cost_cny + r.e.freight_cny), 0);

  const tableRows: EvaluationRow[] = rows.map(({ e, alpha, safety }) => ({
    id: e.id,
    asin: e.asin,
    name: e.name,
    image_url: e.image_url,
    category_path: e.category_path,
    created_at: e.created_at,
    status: e.status,
    kind: alpha ? rowKind(alpha.decision.level) : "draft",
    opportunityIndex: alpha ? alpha.opportunityIndex : null,
    level: alpha ? alpha.decision.level : null,
    levelLabel: alpha ? alpha.decision.levelLabel : null,
    levelTone: alpha ? LEVEL_TONE[alpha.decision.level] : null,
    safety,
  }));

  return (
    <AppShell
      seller={seller}
      active="dashboard"
      title="我的选品"
      featuredAsin={evals.find((e) => e.status !== "draft")?.asin}
      actions={
        <div className="flex gap-2">
          <Link href="/recommend" className="rounded-lg border border-blue/40 bg-blue-soft px-4 py-2 text-[14px] font-medium text-blue transition hover:bg-blue-soft/70">
            ✨ 按画像推荐
          </Link>
          <Link href="/evaluations/new" className="rounded-lg bg-blue px-4 py-2 text-[14px] font-medium text-white transition hover:bg-blue-strong">
            + 新建评估
          </Link>
        </div>
      }
    >
      <div className="mb-1 text-[14px] text-muted">
        本月 +{recommend} 建议进入 · 总节省评估时间 ~14h
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="命中率" value={`${hitRate}%`} sub="近 30 天" tone="blue" />
        <Stat label="平均机会指数" value={avgIndex} sub="进入门槛 62" />
        <Stat label="节省备货" value={cny(avoided, { compact: true })} sub={`避坑 ${avoid} 单`} />
        <Stat label="评估额度" value={`${seller.eval_quota_used}/${seller.eval_quota_total}`} sub={seller.plan} />
      </div>

      <EvaluationTable
        rows={tableRows}
        counts={{ all: evals.length, recommend, watch, avoid, draft: drafts }}
      />
    </AppShell>
  );
}
