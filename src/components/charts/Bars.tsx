import type { ReactNode } from "react";

export function MetricBar({
  score,
  title,
  caption,
  tone = "ink",
}: {
  score: number;
  title: string;
  caption: ReactNode;
  tone?: "ink" | "green" | "orange" | "red";
}) {
  const color =
    tone === "green"
      ? "var(--color-green)"
      : tone === "orange"
        ? "var(--color-orange)"
        : tone === "red"
          ? "var(--color-red)"
          : "var(--color-ink)";
  return (
    <div className="flex items-center gap-4 py-2.5">
      <div className="h-3 w-24 shrink-0 rounded border border-line bg-panel-2">
        <div
          className="h-full rounded-l"
          style={{ width: `${Math.min(100, score)}%`, background: color }}
        />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-lg font-bold">{score}</span>
        <span className="font-serif text-[15px]">{title}</span>
        <span className="text-[13px] text-muted">{caption}</span>
      </div>
    </div>
  );
}

// Histogram for the CPC distribution.
export function Histogram({
  bins,
  labels,
  markerFrac,
  markerLabel,
}: {
  bins: number[];
  labels: string[];
  markerFrac?: number;
  markerLabel?: string;
}) {
  const max = Math.max(...bins, 1);
  return (
    <div className="relative">
      <div className="flex h-36 items-end gap-2">
        {bins.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-muted/60"
            style={{ height: `${(b / max) * 100}%` }}
          />
        ))}
      </div>
      {markerFrac !== undefined ? (
        <div
          className="absolute top-0 bottom-6 border-l-2 border-dashed border-blue"
          style={{ left: `${markerFrac * 100}%` }}
        >
          <span className="absolute -top-1 left-1 whitespace-nowrap font-mono text-[12px] text-blue">
            {markerLabel}
          </span>
        </div>
      ) : null}
      <div className="mt-1 flex justify-between font-mono text-[12px] text-muted">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
    </div>
  );
}
