import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  dashed = false,
  highlight = false,
}: {
  children: ReactNode;
  className?: string;
  dashed?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        dashed ? "border-dashed" : "shadow-card"
      } ${
        highlight ? "border-blue/30 bg-blue-soft" : "border-line bg-panel"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "green" | "orange" | "red" | "blue";
}) {
  const color =
    tone === "green"
      ? "text-green"
      : tone === "orange"
        ? "text-orange"
        : tone === "red"
          ? "text-red"
          : tone === "blue"
            ? "text-blue"
            : "text-ink";
  return (
    <Card>
      <div className="font-serif text-[13px] text-muted">{label}</div>
      <div className={`mt-1 font-mono text-3xl font-bold tracking-tight ${color}`}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[13px] text-muted">{sub}</div> : null}
    </Card>
  );
}

export function KeyPointList({
  points,
}: {
  points: { icon: "ok" | "warn"; text: ReactNode }[];
}) {
  return (
    <ul className="space-y-2">
      {points.map((p, i) => (
        <li key={i} className="flex items-start gap-2 text-[15px]">
          <span className={p.icon === "ok" ? "text-green" : "text-orange"}>
            {p.icon === "ok" ? "✓" : "⚠"}
          </span>
          <span className="font-serif">{p.text}</span>
        </li>
      ))}
    </ul>
  );
}
