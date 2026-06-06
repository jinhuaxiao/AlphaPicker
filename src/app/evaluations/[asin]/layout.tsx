import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EvalTabs } from "@/components/EvalTabs";
import { StatusBadge } from "@/components/Badge";
import { getEvaluationByAsin, getSeller, getReviewInsight } from "@/lib/queries";
import { runAlpha } from "@/lib/alpha";
import type { DecisionLevel } from "@/lib/alpha";
import { toVocPainPoints } from "@/lib/reviews";
import { usd, cny, platformUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

const LEVEL_TONE: Record<DecisionLevel, string> = {
  enter_and_scale: "border-green/40 bg-green-soft text-green",
  enter: "border-blue/40 bg-blue-soft text-blue",
  observe_or_micro_test: "border-orange/40 bg-orange-soft text-orange",
  avoid: "border-red/40 bg-red-soft text-red",
};

function indexColor(i: number) {
  return i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";
}

export default async function EvaluationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ asin: string }>;
}) {
  const { asin } = await params;
  const [e, seller] = await Promise.all([getEvaluationByAsin(asin), getSeller()]);
  if (!e || !seller) notFound();

  // Single source of truth: the v2 decision algorithm with the SAME inputs as the
  // 机会决策 tab (incl. real review VOC), so the header verdict can't contradict it.
  const scored = e.status !== "draft";
  const reviewInsight = scored ? await getReviewInsight(seller.id, e.asin) : null;
  const vocOverride = reviewInsight?.painPoints.length
    ? toVocPainPoints(reviewInsight.painPoints)
    : undefined;
  const alpha = scored ? runAlpha(e, seller, [], {}, vocOverride) : null;
  const url = platformUrl(e.asin, e.target_market);
  const platformLabel = url?.includes("ebay.") ? "eBay" : url ? "Amazon" : null;

  return (
    <AppShell
      seller={seller}
      featuredAsin={asin}
      breadcrumb={
        <>
          <Link href="/dashboard" className="hover:text-blue transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            我的选品
          </Link>
          <span className="text-line-strong">/</span>
          <span className="text-ink font-medium flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            评估详情
          </span>
        </>
      }
      title={e.name}
    >
      {/* Product summary */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-panel p-4 shadow-card">
        {e.image_url && url ? (
          <a href={url} target="_blank" rel="noreferrer noopener" title={`在 ${platformLabel} 查看原始 listing`} className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={e.image_url} alt={e.name} className="h-14 w-14 rounded-lg border border-line object-cover transition hover:opacity-80" />
          </a>
        ) : e.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={e.image_url} alt={e.name} className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover" />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-[12px] text-subtle">IMG</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener" className="truncate text-[18px] font-semibold hover:text-blue hover:underline" title={`在 ${platformLabel} 查看原始 listing`}>
                {e.name}
                <span className="ml-1 align-middle text-[12px] text-muted">↗</span>
              </a>
            ) : (
              <h2 className="truncate text-[18px] font-semibold">{e.name}</h2>
            )}
            {alpha ? (
              <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${LEVEL_TONE[alpha.decision.level]}`}>
                {alpha.decision.levelLabel}
              </span>
            ) : (
              <StatusBadge status={e.status} />
            )}
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {e.category_path} ·{" "}
            {url ? (
              <a href={url} target="_blank" rel="noreferrer noopener" className="font-mono hover:text-blue hover:underline">{e.asin}</a>
            ) : (
              <span className="font-mono">{e.asin}</span>
            )}{" "}
            · {usd(e.price_usd)} · 成本 {cny(e.cost_cny)} + {usd(e.fba_fee_usd)} FBA
          </div>
        </div>
        {alpha ? (
          <div className="rounded-lg border border-line px-4 py-2 text-center">
            <div className="text-[11px] uppercase tracking-widest-xs text-muted">机会指数</div>
            <div className={`font-mono text-2xl font-bold leading-tight ${indexColor(alpha.opportunityIndex)}`}>
              {alpha.opportunityIndex}
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <EvalTabs asin={asin} />
      </div>

      <div className="mt-6">{children}</div>
    </AppShell>
  );
}
