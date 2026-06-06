import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stat } from "@/components/Card";
import { StatusBadge } from "@/components/Badge";
import { getSeller, getEvaluations, pnlInputsFor } from "@/lib/queries";
import { acosSafety } from "@/lib/economics";
import { cny, signedPt, relativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const seller = await getSeller();
  if (!seller) redirect("/onboarding");
  const evals = await getEvaluations(seller.id);

  const scored = evals.filter((e) => e.status !== "draft");
  const recommend = scored.filter((e) => e.status === "recommend").length;
  const watch = scored.filter((e) => e.status === "watch").length;
  const avoid = scored.filter((e) => e.status === "avoid").length;
  const drafts = evals.filter((e) => e.status === "draft").length;

  const avgScore = scored.length
    ? Math.round(scored.reduce((a, e) => a + e.composite, 0) / scored.length)
    : 0;
  const hitRate = scored.length
    ? Math.round(((recommend + watch) / scored.length) * 100)
    : 0;
  const avoided = evals
    .filter((e) => e.status === "avoid")
    .reduce((a, e) => a + e.target_monthly_units * (e.cost_cny + e.freight_cny), 0);

  return (
    <AppShell
      seller={seller}
      active="dashboard"
      title="我的选品"
      featuredAsin={evals.find((e) => e.status !== "draft")?.asin}
      actions={
        <div className="flex gap-2">
          <Link
            href="/recommend"
            className="rounded-lg border border-blue/40 bg-blue-soft px-4 py-2 text-[14px] font-medium text-blue transition hover:bg-blue-soft/70"
          >
            ✨ 按画像推荐
          </Link>
          <Link
            href="/evaluations/new"
            className="rounded-lg bg-blue px-4 py-2 text-[14px] font-medium text-white transition hover:bg-blue-strong"
          >
            + 新建评估
          </Link>
        </div>
      }
    >
      <div className="mb-1 text-[14px] text-muted">
        本月 +{recommend} 推荐进入 · 总节省评估时间 ~14h
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="命中率" value={`${hitRate}%`} sub="近 30 天" tone="blue" />
        <Stat label="平均评分" value={avgScore} sub="推进门槛 60" />
        <Stat label="节省备货" value={cny(avoided, { compact: true })} sub={`避坑 ${avoid} 单`} />
        <Stat label="评估额度" value={`${seller.eval_quota_used}/${seller.eval_quota_total}`} sub={seller.plan} />
      </div>

      <div className="mt-6 rounded-xl border border-line bg-panel shadow-card">
        <div className="flex flex-wrap items-center gap-5 border-b border-line px-5 py-3 text-[14px]">
          <span className="font-medium text-blue">全部 {evals.length}</span>
          <span className="text-muted">推荐 {recommend}</span>
          <span className="text-muted">观望 {watch}</span>
          <span className="text-muted">不建议 {avoid}</span>
          <span className="text-muted">草稿 {drafts}</span>
        </div>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="text-[12px] text-muted">
              <th className="px-5 py-2.5 font-normal">产品</th>
              <th className="px-5 py-2.5 font-normal">类目</th>
              <th className="px-5 py-2.5 text-right font-normal">综合</th>
              <th className="px-5 py-2.5 text-right font-normal">ACOS 安全边际</th>
              <th className="px-5 py-2.5 font-normal">建议</th>
              <th className="px-5 py-2.5 text-right font-normal">更新</th>
            </tr>
          </thead>
          <tbody>
            {evals.map((e) => {
              const safety =
                e.status === "draft" ? null : acosSafety(pnlInputsFor(e)).safetyPt;
              return (
                <tr key={e.id} className="border-t border-line transition hover:bg-panel-2/60">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {e.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-line object-cover" />
                      ) : (
                        <div className="h-9 w-9 shrink-0 rounded-md bg-panel-2" />
                      )}
                      <Link
                        href={`/evaluations/${e.asin}/score`}
                        className="block max-w-[22rem] truncate text-[15px] font-medium hover:text-blue"
                      >
                        {e.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-[14px] text-muted">
                    {e.category_path.split(" › ").slice(0, 2).join(" · ")}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[15px] font-bold">
                    {e.status === "draft" ? "—" : e.composite}
                  </td>
                  <td className={`px-5 py-3.5 text-right font-mono ${safety === null ? "text-muted" : safety >= 0 ? "text-ink" : "text-red"}`}>
                    {safety === null ? "—" : signedPt(safety)}
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-5 py-3.5 text-right text-[14px] text-muted">
                    {relativeTime(e.created_at)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
