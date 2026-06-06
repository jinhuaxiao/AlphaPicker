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
    { key: "recommend", label: "建议进入", count: counts.recommend },
    { key: "watch", label: "观望", count: counts.watch },
    { key: "avoid", label: "不建议", count: counts.avoid },
    { key: "draft", label: "草稿", count: counts.draft },
  ];

  const visible = tab === "all" ? rows : rows.filter((r) => r.kind === tab);

  return (
    <div className="mt-6 rounded-xl border border-line bg-panel shadow-card">
      <div className="flex flex-wrap items-center gap-5 border-b border-line px-5 py-3 text-[14px]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`transition ${
              tab === t.key ? "font-medium text-blue" : "text-muted hover:text-ink"
            }`}
          >
            {t.label} {t.count}
          </button>
        ))}
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="text-[12px] text-muted">
            <th className="px-5 py-2.5 font-normal">产品</th>
            <th className="px-5 py-2.5 font-normal">类目</th>
            <th className="px-5 py-2.5 text-right font-normal">机会指数</th>
            <th className="px-5 py-2.5 text-right font-normal">ACOS 安全边际</th>
            <th className="px-5 py-2.5 font-normal">建议</th>
            <th className="px-5 py-2.5 text-right font-normal">更新</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-10 text-center text-[14px] text-muted">
                暂无数据
              </td>
            </tr>
          ) : (
            visible.map((r) => (
              <tr key={r.id} className="border-t border-line transition hover:bg-panel-2/60">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.image_url} alt="" className="h-9 w-9 shrink-0 rounded-md border border-line object-cover" />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-md bg-panel-2" />
                    )}
                    <Link href={`/evaluations/${r.asin}/decision`} className="block max-w-[22rem] truncate text-[15px] font-medium hover:text-blue">
                      {r.name}
                    </Link>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-[14px] text-muted">
                  {r.category_path.split(" › ").slice(0, 2).join(" · ")}
                </td>
                <td className={`px-5 py-3.5 text-right font-mono text-[15px] font-bold ${r.opportunityIndex !== null ? indexColor(r.opportunityIndex) : "text-muted"}`}>
                  {r.opportunityIndex !== null ? r.opportunityIndex : "—"}
                </td>
                <td className={`px-5 py-3.5 text-right font-mono ${r.safety === null ? "text-muted" : r.safety >= 0 ? "text-ink" : "text-red"}`}>
                  {r.safety === null ? "—" : signedPt(r.safety)}
                </td>
                <td className="px-5 py-3.5">
                  {r.level ? (
                    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[13px] font-medium ${r.levelTone}`}>
                      {r.levelLabel}
                    </span>
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                </td>
                <td className="px-5 py-3.5 text-right text-[14px] text-muted">
                  {relativeTime(r.created_at)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
