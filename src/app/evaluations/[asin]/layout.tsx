import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { EvalTabs } from "@/components/EvalTabs";
import { StatusBadge } from "@/components/Badge";
import { getEvaluationByAsin, getSeller } from "@/lib/queries";
import { usd, cny } from "@/lib/format";

export const dynamic = "force-dynamic";

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

  return (
    <AppShell
      seller={seller}
      featuredAsin={asin}
      breadcrumb={
        <span>
          <Link href="/dashboard" className="hover:text-ink">我的选品</Link> / 评估
        </span>
      }
      title={e.name}
    >
      {/* Product summary */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-line bg-panel p-4 shadow-card">
        {e.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.image_url}
            alt={e.name}
            className="h-14 w-14 shrink-0 rounded-lg border border-line object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-[12px] text-subtle">
            IMG
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h2 className="truncate text-[18px] font-semibold">{e.name}</h2>
            <StatusBadge status={e.status} />
          </div>
          <div className="mt-0.5 truncate text-[13px] text-muted">
            {e.category_path} · <span className="font-mono">{e.asin}</span> · {usd(e.price_usd)} ·
            成本 {cny(e.cost_cny)} + {usd(e.fba_fee_usd)} FBA
          </div>
        </div>
        {e.status !== "draft" ? (
          <div className="rounded-lg border border-line px-4 py-2 text-center">
            <div className="text-[11px] uppercase tracking-widest-xs text-muted">综合分</div>
            <div className="font-mono text-2xl font-bold leading-tight text-blue">{e.composite}</div>
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
