"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/Badge";
import type { EvaluationStatus } from "@/lib/types";
import { signedPt, platformUrl } from "@/lib/format";

export type RowKind = "recommend" | "watch" | "avoid" | "draft";

export type EvaluationRow = {
  id: string | number;
  asin: string;
  name: string;
  image_url: string | null;
  target_market: string;
  category_path: string;
  created_at: string;
  status: EvaluationStatus;
  kind: RowKind;
  opportunityIndex: number | null;
  level: string | null;
  levelLabel: string | null;
  levelTone: string | null;
  safety: number | null;
  marketSize: "大" | "中" | "小";
  competition: "高" | "中" | "低";
  targetUnits: number;
  grossMarginPct: number;
};

const indexColor = (i: number) =>
  i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";

const competitionColor = (c: EvaluationRow["competition"]) =>
  c === "高" ? "text-red" : c === "中" ? "text-orange" : "text-green";

const marketSizeColor = (s: EvaluationRow["marketSize"]) =>
  s === "大" ? "text-blue" : s === "中" ? "text-ink" : "text-muted";

/** Compact labels for table cells — full text stays in `title`. */
const SHORT_LEVEL_LABEL: Record<string, string> = {
  enter_and_scale: "建议进入",
  enter: "标准测试",
  observe_or_micro_test: "观望微测",
  avoid: "不建议",
};

type TabKey = "all" | RowKind;

function ProductThumb({ row }: { row: EvaluationRow }) {
  if (row.image_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={row.image_url} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
    );
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 text-[15px] font-semibold text-muted"
      title="暂无产品图"
    >
      {row.name?.trim()?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function RowStatus({ row, compact = false }: { row: EvaluationRow; compact?: boolean }) {
  if (row.level) {
    const label = compact ? (SHORT_LEVEL_LABEL[row.level] ?? row.levelLabel) : row.levelLabel;
    return (
      <span
        title={row.levelLabel ?? undefined}
        className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight ${row.levelTone}`}
      >
        {label}
      </span>
    );
  }
  return <StatusBadge status={row.status} />;
}

function RowActions({ row }: { row: EvaluationRow }) {
  const url = platformUrl(row.asin, row.target_market);
  return (
    <div className="flex items-center gap-3">
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" title="打开真实商品页" className="hover:text-blue transition">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </a>
      ) : (
        <span title="无真实商品链接（手动/草稿录入）" className="cursor-not-allowed text-muted/30">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </span>
      )}
      <Link href={`/evaluations/${row.asin}/decision`} title="查看评估详情" className="hover:text-ink transition">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
      </Link>
    </div>
  );
}

function CategoryBreadcrumb({ path }: { path: string }) {
  return (
    <>
      {path.split(" › ").slice(0, 2).map((part, i, arr) => (
        <span key={i}>
          {part}
          {i < arr.length - 1 && <span className="mx-1">&gt;</span>}
        </span>
      ))}
    </>
  );
}

function EvaluationCard({ row }: { row: EvaluationRow }) {
  return (
    <div className="px-4 py-4 transition hover:bg-panel-2/60">
      <div className="flex items-start gap-3">
        <input type="checkbox" className="mt-1 rounded border-line text-blue focus:ring-blue" />
        <ProductThumb row={row} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/evaluations/${row.asin}/decision`} className="line-clamp-2 text-[14px] font-medium leading-snug hover:text-blue">
              {row.name}
            </Link>
            <span className={`shrink-0 font-mono text-[15px] font-bold ${row.opportunityIndex !== null ? indexColor(row.opportunityIndex) : "text-muted"}`}>
              {row.opportunityIndex !== null ? row.opportunityIndex : "—"}
            </span>
          </div>
          <div className="mt-1 text-[12px] text-muted">{row.asin}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RowStatus row={row} compact />
            <span className="text-[12px] text-muted">{row.created_at.slice(0, 10)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div>
              <span className="text-muted">竞争度 </span>
              <span className={`font-medium ${competitionColor(row.competition)}`}>{row.competition}</span>
            </div>
            <div>
              <span className="text-muted">月销 </span>
              <span className="font-mono text-ink">{row.targetUnits.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted">毛利率 </span>
              <span className="font-mono text-ink">{row.grossMarginPct}%</span>
            </div>
            <div>
              <span className="text-muted">安全边际 </span>
              <span className={`font-mono ${row.safety === null ? "text-muted" : row.safety >= 0 ? "text-ink" : "text-red"}`}>
                {row.safety === null ? "—" : signedPt(row.safety)}
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="line-clamp-1 text-[12px] text-muted">
              <CategoryBreadcrumb path={row.category_path} />
            </div>
            <RowActions row={row} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EvaluationTable({
  rows,
  counts,
}: {
  rows: EvaluationRow[];
  counts: { all: number; recommend: number; watch: number; avoid: number; draft: number };
}) {
  const [tab, setTab] = useState<TabKey>("all");

  const tabs: { key: TabKey; label: string; count: number }[] = [
    { key: "all", label: "全部", count: counts.all },
    { key: "draft", label: "评估中", count: counts.draft },
    { key: "recommend", label: "可行", count: counts.recommend },
    { key: "watch", label: "待优化", count: counts.watch },
    { key: "avoid", label: "不可行", count: counts.avoid },
  ];

  const visible = tab === "all" ? rows : rows.filter((r) => r.kind === tab);

  return (
    <div className="@container mt-6 min-w-0 overflow-hidden rounded-xl border border-line bg-panel shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 text-[14px] sm:px-5 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
        <div className="-mx-1 flex items-center gap-4 overflow-x-auto px-1 pb-0.5 sm:gap-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`relative shrink-0 whitespace-nowrap transition ${
                tab === t.key ? "font-medium text-blue" : "text-muted hover:text-ink"
              }`}
            >
              {t.label} ({t.count})
              {tab === t.key && (
                <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 rounded-t-full bg-blue" />
              )}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="搜索产品名称或 ASIN" className="h-8 w-full rounded-lg border border-line bg-panel-2/50 pl-9 pr-3 text-[13px] outline-none transition focus:border-blue focus:bg-panel focus:ring-1 focus:ring-blue sm:w-48" />
          </div>
          <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink transition hover:bg-panel-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            <span className="hidden sm:inline">筛选</span>
          </button>
          <button className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink transition hover:bg-panel-2">
            <span className="hidden sm:inline">最新评估</span>
            <span className="sm:hidden">排序</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
      </div>

      {/* Mobile / narrow: card list */}
      <div className="divide-y divide-line md:hidden">
        {visible.length === 0 ? (
          <div className="px-4 py-10 text-center text-[14px] text-muted">暂无数据</div>
        ) : (
          visible.map((r) => <EvaluationCard key={r.id} row={r} />)
        )}
      </div>

      {/* Tablet+: @container on card measures visible width; inner div scrolls */}
      <div className="hidden md:block">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-0 border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[12px] text-muted">
              <th className="sticky left-0 z-20 min-w-[200px] bg-panel px-4 py-3 font-normal shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] sm:min-w-[240px] sm:px-5">
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-line text-blue focus:ring-blue" />
                  产品信息
                </div>
              </th>
              <th className="hidden min-w-[130px] px-4 py-3 font-normal @2xl:table-cell sm:px-5">类目</th>
              <th className="min-w-[4rem] whitespace-nowrap px-3 py-3 font-normal">机会指数</th>
              <th className="hidden min-w-[3.5rem] whitespace-nowrap px-3 py-3 font-normal @2xl:table-cell">竞争度</th>
              <th className="hidden min-w-[3.5rem] whitespace-nowrap px-3 py-3 font-normal @xl:table-cell">毛利率</th>
              <th className="hidden min-w-[4rem] whitespace-nowrap px-3 py-3 font-normal @2xl:table-cell">安全边际</th>
              <th className="hidden min-w-[3.5rem] whitespace-nowrap px-3 py-3 font-normal @2xl:table-cell">市场规模</th>
              <th className="hidden min-w-[4rem] whitespace-nowrap px-3 py-3 text-right font-normal @2xl:table-cell">预计月销</th>
              <th className="min-w-[5rem] whitespace-nowrap px-3 py-3 font-normal">状态</th>
              <th className="hidden min-w-[5.5rem] whitespace-nowrap px-3 py-3 font-normal @2xl:table-cell">评估时间</th>
              <th className="sticky right-0 z-20 min-w-[4.5rem] whitespace-nowrap bg-panel px-4 py-3 font-normal shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-[14px] text-muted">
                  暂无数据
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr key={r.id} className="group border-b border-line last:border-0 transition hover:bg-panel-2/60">
                  <td className="sticky left-0 z-20 min-w-[200px] bg-panel px-4 py-3 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.08)] transition-colors group-hover:bg-panel-2/60 sm:min-w-[240px] sm:px-5">
                    <div className="flex items-start gap-3">
                      <input type="checkbox" className="mt-1 rounded border-line text-blue focus:ring-blue" />
                      <ProductThumb row={r} />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/evaluations/${r.asin}/decision`}
                          title={r.name}
                          className="line-clamp-2 text-[13px] font-medium leading-snug hover:text-blue"
                        >
                          {r.name}
                        </Link>
                        <div className="mt-0.5 font-mono text-[11px] text-muted">{r.asin}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] @2xl:hidden">
                          <span className={`font-medium ${competitionColor(r.competition)}`}>{r.competition}竞争</span>
                          <span className="text-subtle">·</span>
                          <span className="text-muted">{r.grossMarginPct}% 毛利</span>
                          <span className="text-subtle">·</span>
                          <span className="text-subtle">{r.created_at.slice(0, 10)}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="hidden min-w-[140px] max-w-[200px] px-4 py-3 text-[12px] leading-snug text-muted @2xl:table-cell sm:px-5">
                    <div className="line-clamp-2" title={r.category_path}>
                      <CategoryBreadcrumb path={r.category_path} />
                    </div>
                  </td>
                  <td className={`min-w-[4.5rem] whitespace-nowrap px-3 py-3 font-mono text-[15px] font-bold ${r.opportunityIndex !== null ? indexColor(r.opportunityIndex) : "text-muted"}`}>
                    {r.opportunityIndex !== null ? r.opportunityIndex : "—"}
                  </td>
                  <td className={`hidden min-w-[4.5rem] whitespace-nowrap px-3 py-3 text-[13px] font-medium @2xl:table-cell ${competitionColor(r.competition)}`}>
                    {r.competition}
                  </td>
                  <td className="hidden min-w-[4rem] whitespace-nowrap px-3 py-3 text-right font-mono text-[13px] text-ink @xl:table-cell">
                    {r.grossMarginPct}%
                  </td>
                  <td className={`hidden min-w-[4.5rem] whitespace-nowrap px-3 py-3 font-mono text-[13px] @2xl:table-cell ${r.safety === null ? "text-muted" : r.safety >= 0 ? "text-ink" : "text-red"}`}>
                    {r.safety === null ? "—" : signedPt(r.safety)}
                  </td>
                  <td className={`hidden min-w-[4rem] whitespace-nowrap px-3 py-3 text-[13px] font-medium @2xl:table-cell ${marketSizeColor(r.marketSize)}`}>
                    {r.marketSize}
                  </td>
                  <td className="hidden min-w-[4.5rem] whitespace-nowrap px-3 py-3 text-right font-mono text-[13px] text-ink @2xl:table-cell">
                    {r.targetUnits.toLocaleString()}
                  </td>
                  <td className="min-w-[5.5rem] px-3 py-3">
                    <RowStatus row={r} compact />
                  </td>
                  <td className="hidden min-w-[6rem] whitespace-nowrap px-3 py-3 text-[12px] text-muted @2xl:table-cell">
                    {r.created_at.slice(0, 10)}
                  </td>
                  <td className="sticky right-0 z-20 min-w-[4.5rem] bg-panel px-4 py-3 text-muted shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] transition-colors group-hover:bg-panel-2/60">
                    <RowActions row={r} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
