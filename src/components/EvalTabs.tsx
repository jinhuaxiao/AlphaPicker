"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS: { label: string; tabs: { key: string; label: string }[] }[] = [
  {
    label: "评分视图",
    tabs: [
      { key: "score", label: "评分卡" },
      { key: "sandbox", label: "投资沙盘" },
      { key: "cockpit", label: "驾驶舱" },
    ],
  },
  {
    label: "决策",
    tabs: [{ key: "decision", label: "★ 机会决策" }],
  },
  {
    label: "深度分析",
    tabs: [
      { key: "keywords", label: "关键词" },
      { key: "acos", label: "ACOS" },
      { key: "simulator", label: "模拟器" },
      { key: "scenarios", label: "三场景" },
      { key: "report", label: "决策报告" },
    ],
  },
];

export function EvalTabs({ asin }: { asin: string }) {
  const pathname = usePathname();
  const current = pathname.split("/").pop();

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
      {GROUPS.map((g, gi) => (
        <div key={g.label} className="flex items-center gap-1">
          {gi > 0 ? <span className="mx-2 h-5 w-px bg-line" /> : null}
          {g.tabs.map((t) => {
            const isActive = current === t.key;
            return (
              <Link
                key={t.key}
                href={`/evaluations/${asin}/${t.key}`}
                className={`relative whitespace-nowrap px-3 py-2.5 text-[14px] transition ${
                  isActive
                    ? "font-medium text-blue"
                    : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {isActive ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue" />
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
