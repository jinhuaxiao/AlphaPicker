import type { ReactNode } from "react";
import { STATUS_META, type EvaluationStatus } from "@/lib/types";

const TONE: Record<string, string> = {
  green: "border-green/40 bg-green-soft text-green",
  orange: "border-orange/40 bg-orange-soft text-orange",
  red: "border-red/40 bg-red-soft text-red",
  ink: "border-line bg-panel-2 text-muted",
  blue: "border-blue/40 bg-blue-soft text-blue",
};

export function StatusBadge({ status }: { status: EvaluationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px] font-medium ${TONE[meta.tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {meta.label}
    </span>
  );
}

export function Pill({
  children,
  tone = "ink",
  className = "",
}: {
  children: ReactNode;
  tone?: keyof typeof TONE;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] ${TONE[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[12px] uppercase tracking-widest-xs text-blue">
      {children}
    </div>
  );
}
