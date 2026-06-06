import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Stat } from "@/components/Card";
import { EvaluationTable, type EvaluationRow, type RowKind } from "@/components/EvaluationTable";
import { RadarChart } from "@/components/charts/RadarChart";
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
  // Hide products without a product image for now (demo/draft/manual entries
  // that never got an image) — keep the board to real, imaged products.
  const evals = (await getEvaluations(seller.id)).filter(
    (e) => e.image_url && e.image_url.trim() !== "",
  );

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
    target_market: e.target_market,
    category_path: e.category_path,
    created_at: e.created_at,
    status: e.status,
    kind: alpha ? rowKind(alpha.decision.level) : "draft",
    opportunityIndex: alpha ? alpha.opportunityIndex : null,
    level: alpha ? alpha.decision.level : null,
    levelLabel: alpha ? alpha.decision.levelLabel : null,
    levelTone: alpha ? LEVEL_TONE[alpha.decision.level] : null,
    safety,
    // 市场规模 from the (TAM-blended) demand score; 竞争度 from head concentration.
    marketSize: e.scores.demand >= 70 ? "大" : e.scores.demand >= 45 ? "中" : "小",
    competition: e.top3_concentration >= 60 ? "高" : e.top3_concentration >= 40 ? "中" : "低",
    targetUnits: e.target_monthly_units,
    grossMarginPct: e.gross_margin_pct,
  }));

  const radarData = [
    { label: "家居生活", value: 92 },
    { label: "美妆个护", value: 91 },
    { label: "宠物用品", value: 87 },
    { label: "母婴玩具", value: 83 },
    { label: "户外运动", value: 85 },
    { label: "3C数码", value: 88 },
  ];

  return (
    <AppShell
      seller={seller}
      active="dashboard"
      featuredAsin={evals.find((e) => e.status !== "draft")?.asin}
    >
      <div className="relative -mt-6 -mx-6 px-6 pt-10 pb-8 bg-gradient-to-br from-blue-soft/50 via-white to-purple-50/50">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Hi, {seller.name} 团队 👋</h1>
            <p className="mt-2 text-[15px] text-muted">欢迎回来！以下是你团队的选品决策概览</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 text-[14px] font-medium text-ink transition hover:bg-panel-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              导出数据
            </button>
            <Link href="/evaluations/new" className="flex items-center gap-2 rounded-lg bg-blue px-4 py-2 text-[14px] font-medium text-white transition hover:bg-blue-strong shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              新建评估
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          {/* Radar Chart Card */}
          <div className="relative rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-md overflow-hidden group min-h-[480px] flex flex-col">
            <style>{`
              @keyframes scan {
                0% { top: 0; opacity: 0; }
                10% { opacity: 1; }
                90% { opacity: 1; }
                100% { top: 100%; opacity: 0; }
              }
            `}</style>
            
            {/* Tech Grid Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(79,70,229,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(79,70,229,0.04)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
            
            {/* Scanning Line */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
              <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-blue/40 to-transparent absolute top-0 animate-[scan_4s_ease-in-out_infinite]"></div>
            </div>

            {/* HUD Corners */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-blue/30 rounded-tl-lg pointer-events-none"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-blue/30 rounded-tr-lg pointer-events-none"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-blue/30 rounded-bl-lg pointer-events-none"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-blue/30 rounded-br-lg pointer-events-none"></div>

            {/* Floating Data - Left */}
            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex-col gap-8 opacity-80 hidden md:flex pointer-events-none">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">MARKET.VOL</div>
                <div className="font-mono text-lg text-ink font-bold">24.5B</div>
                <div className="h-1 w-16 bg-blue/10 rounded overflow-hidden mt-1">
                  <div className="h-full bg-blue w-[75%]"></div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">TREND.SIGNAL</div>
                <div className="font-mono text-[13px] text-ink flex items-center gap-1">
                  <span className="text-green">↑</span> UPWARD
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">COMP.INDEX</div>
                <div className="font-mono text-[13px] text-ink">MED / 42.8</div>
              </div>
            </div>

            {/* Floating Data - Right */}
            <div className="absolute right-6 top-1/2 -translate-y-1/2 flex-col gap-8 opacity-80 text-right hidden md:flex pointer-events-none">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">SYS.STATUS</div>
                <div className="font-mono text-[13px] text-green flex items-center justify-end gap-1.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green"></span>
                  </span>
                  ONLINE
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">ALGORITHM</div>
                <div className="font-mono text-[13px] text-ink">ALPHA_V2.4</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-blue font-semibold tracking-wider">CONFIDENCE</div>
                <div className="font-mono text-lg text-ink font-bold">98.2%</div>
                <div className="h-1 w-16 bg-blue/10 rounded overflow-hidden mt-1 ml-auto">
                  <div className="h-full bg-blue w-[98%]"></div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center gap-2 text-[15px] font-semibold text-ink mb-2">
              机会分布雷达
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue"></span>
              </span>
            </div>
            <div className="relative flex-1 flex justify-center items-center mt-4">
              <RadarChart axes={radarData} size={420} />
            </div>
          </div>

          {/* AI Decision Brief */}
          <div className="rounded-2xl border border-white/60 bg-white/60 p-6 shadow-sm backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="text-blue"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"></path></svg>
                AI 决策简报
              </div>
              <span className="rounded-full border border-line bg-panel-2/50 px-2.5 py-0.5 text-[12px] text-muted">
                基于 15 个评估结果
              </span>
            </div>

            <div className="rounded-lg bg-blue-soft/50 px-4 py-3 mb-5">
              <div className="text-[13px] text-blue font-medium mb-1">当前最佳机会</div>
              <div className="text-[14px] font-medium text-ink">家居生活 &gt; 厨房用品 &gt; 创新收纳</div>
            </div>

            <div className="space-y-4 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-ink">需求强劲</div>
                    <div className="mt-0.5 text-[13px] text-muted">搜索量稳步上升，市场需求持续增长</div>
                  </div>
                </div>
                <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="text-blue opacity-40 mt-1">
                  <path d="M0 20 Q 10 20, 15 15 T 30 10 T 45 5 T 60 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
              
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-soft text-blue">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-ink">竞争适中</div>
                    <div className="mt-0.5 text-[13px] text-muted">头部集中度 28%，中小卖家机会较大</div>
                  </div>
                </div>
                <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="text-blue opacity-40 mt-1">
                  <path d="M0 15 Q 15 15, 20 10 T 40 12 T 60 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-soft text-orange">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  </div>
                  <div>
                    <div className="text-[14px] font-medium text-ink">利润可观</div>
                    <div className="mt-0.5 text-[13px] text-muted">毛利率中位数 45%，具备良好盈利空间</div>
                  </div>
                </div>
                <svg width="60" height="24" viewBox="0 0 60 24" fill="none" className="text-orange opacity-40 mt-1">
                  <path d="M0 22 Q 10 20, 20 15 T 40 8 T 60 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
                </svg>
              </div>
            </div>

            <div className="mt-5 border-t border-line/50 pt-4 flex items-start gap-2">
              <span className="text-[13px] font-medium text-ink shrink-0">建议:</span>
              <span className="text-[13px] text-muted">优先评估收纳类创新产品，关注差异化设计</span>
              <button className="ml-auto text-blue hover:text-blue-strong transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 16 16 12 12 8"></polyline><line x1="8" y1="12" x2="16" y2="12"></line></svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-line bg-panel p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-soft text-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
          </div>
          <div>
            <div className="text-[13px] text-muted">命中率</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">100%</span>
              <span className="text-[12px] font-medium text-green">较上期 ↑ 12%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-50 text-purple-600">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"></path></svg>
          </div>
          <div>
            <div className="text-[13px] text-muted">平均机会指数</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">90</span>
              <span className="text-[12px] font-medium text-green">较上期 ↑ 5</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-soft text-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
          </div>
          <div>
            <div className="text-[13px] text-muted">节省备货</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-ink">$24,560</span>
              <span className="text-[12px] font-medium text-green">较上期 ↑ 8%</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-panel p-5 shadow-card flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-soft text-blue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          </div>
          <div className="flex-1">
            <div className="text-[13px] text-muted">评估额度</div>
            <div className="mt-1 flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-2xl font-bold text-ink">7</span>
                <span className="text-[14px] text-muted">/ 30</span>
              </div>
              <span className="text-[12px] text-muted">剩余 23 次</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-blue" style={{ width: '23.3%' }} />
            </div>
          </div>
        </div>
      </div>

      <EvaluationTable
        rows={tableRows}
        counts={{ all: evals.length, recommend, watch, avoid, draft: drafts }}
      />
    </AppShell>
  );
}
