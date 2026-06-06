"use client";

import { useState } from "react";
import Link from "next/link";
import { StatusBadge } from "@/components/Badge";
import type { EvaluationStatus } from "@/lib/types";
import { signedPt, relativeTime } from "@/lib/format";

export type RowKind = "recommend" | "watch" | "avoid" | "draft";

export type EvaluationRow = {
  id: string | number;
  asin: string;
  name: string;
  image_url: string | null;
  category_path: string;
  created_at: string;
  status: EvaluationStatus;
  kind: RowKind;
  opportunityIndex: number | null;
  level: string | null;
  levelLabel: string | null;
  levelTone: string | null;
  safety: number | null;
};

const indexColor = (i: number) =>
  i >= 75 ? "text-green" : i >= 62 ? "text-blue" : i >= 45 ? "text-orange" : "text-red";

type TabKey = "all" | RowKind;

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
    <div className="mt-6 rounded-xl border border-line bg-panel shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-5 border-b border-line px-5 py-3 text-[14px]">
        <div className="flex flex-wrap items-center gap-5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`transition relative ${
                tab === t.key ? "font-medium text-blue" : "text-muted hover:text-ink"
              }`}
            >
              {t.label} ({t.count})
              {tab === t.key && (
                <div className="absolute -bottom-[13px] left-0 right-0 h-0.5 bg-blue rounded-t-full" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" placeholder="搜索产品名称或 ASIN" className="h-8 w-48 rounded-lg border border-line bg-panel-2/50 pl-9 pr-3 text-[13px] outline-none transition focus:border-blue focus:bg-panel focus:ring-1 focus:ring-blue" />
          </div>
          <button className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink transition hover:bg-panel-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
            筛选
          </button>
          <button className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-[13px] text-ink transition hover:bg-panel-2">
            最新评估
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>
        </div>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[12px] text-muted border-b border-line">
            <th className="px-5 py-3 font-normal">
              <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-line text-blue focus:ring-blue" />
                产品信息
              </div>
            </th>
            <th className="px-5 py-3 font-normal">类目</th>
            <th className="px-5 py-3 font-normal">机会指数 <svg className="inline w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 15l5-5 5 5"></path></svg></th>
            <th className="px-5 py-3 font-normal">命中率</th>
            <th className="px-5 py-3 font-normal">市场规模</th>
            <th className="px-5 py-3 font-normal">竞争度</th>
            <th className="px-5 py-3 text-right font-normal">预计月销</th>
            <th className="px-5 py-3 text-right font-normal">毛利率</th>
            <th className="px-5 py-3 font-normal">状态</th>
            <th className="px-5 py-3 font-normal">评估时间</th>
            <th className="px-5 py-3 font-normal">操作</th>
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
              <tr key={r.id} className="border-b border-line last:border-0 transition hover:bg-panel-2/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" className="rounded border-line text-blue focus:ring-blue" />
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line bg-panel-2 text-[15px] font-semibold text-muted"
                        title="暂无产品图"
                      >
                        {r.name?.trim()?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                    <div>
                      <Link href={`/evaluations/${r.asin}/decision`} className="block max-w-[14rem] truncate text-[14px] font-medium hover:text-blue">
                        {r.name}
                      </Link>
                      <div className="text-[12px] text-muted mt-0.5">{r.asin}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[13px] text-muted">
                  {r.category_path.split(" › ").slice(0, 2).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && <span className="mx-1">&gt;</span>}
                    </span>
                  ))}
                </td>
                <td className={`px-5 py-3.5 font-mono text-[15px] font-bold ${r.opportunityIndex !== null ? indexColor(r.opportunityIndex) : "text-muted"}`}>
                  {r.opportunityIndex !== null ? r.opportunityIndex : "—"}
                </td>
                <td className="px-5 py-3.5 text-[13px] text-ink">
                  100%
                </td>
                <td className="px-5 py-3.5 text-[13px] text-blue font-medium">
                  大
                </td>
                <td className="px-5 py-3.5 text-[13px] text-orange font-medium">
                  中
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[14px] text-ink">
                  1,240
                </td>
                <td className="px-5 py-3.5 text-right font-mono text-[14px] text-ink">
                  48%
                </td>
                <td className="px-5 py-3.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-0.5 text-[12px] font-medium text-green">
                    可行
                  </span>
                </td>
                <td className="px-5 py-3.5 text-[13px] text-muted">
                  2025-06-06
                </td>
                <td className="px-5 py-3.5 text-muted">
                  <div className="flex items-center gap-3">
                    <button className="hover:text-ink transition">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                    </button>
                    <button className="hover:text-ink transition">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
