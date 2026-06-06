import Link from "next/link";

const VIEWS = [
  { key: "score", label: "经典评分卡", hint: "scorecard" },
  { key: "sandbox", label: "投资沙盘", hint: "sandbox" },
  { key: "cockpit", label: "决策驾驶舱", hint: "cockpit" },
] as const;

export function ViewSwitch({
  asin,
  active,
}: {
  asin: string;
  active: "score" | "sandbox" | "cockpit";
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="mr-1 font-mono text-[12px] uppercase tracking-widest-xs text-muted">
        ×3 方向
      </span>
      {VIEWS.map((v) => (
        <Link
          key={v.key}
          href={`/evaluations/${asin}/${v.key}`}
          className={`rounded-full border px-4 py-1.5 text-[14px] transition ${
            active === v.key
              ? "border-blue bg-blue-soft text-blue"
              : "border-line bg-panel text-muted hover:text-ink"
          }`}
        >
          {v.label}
        </Link>
      ))}
    </div>
  );
}

const DIVES = [
  { key: "keywords", label: "关键词结构" },
  { key: "acos", label: "ACOS 安全边际" },
  { key: "simulator", label: "盈亏模拟器" },
  { key: "scenarios", label: "三场景模拟" },
  { key: "report", label: "决策报告" },
] as const;

export function DeepDiveNav({
  asin,
  active,
}: {
  asin: string;
  active?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-serif text-[14px] text-muted">下一步：</span>
      {DIVES.map((d) => (
        <Link
          key={d.key}
          href={`/evaluations/${asin}/${d.key}`}
          className={`rounded-lg border px-3.5 py-2 font-serif text-[14px] transition ${
            active === d.key
              ? "border-blue bg-blue-soft text-blue"
              : "border-line bg-panel hover:border-ink"
          }`}
        >
          {d.label}
        </Link>
      ))}
    </div>
  );
}
