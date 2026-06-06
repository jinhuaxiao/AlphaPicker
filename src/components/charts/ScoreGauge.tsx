// Semi-circular gauge used on the cockpit view.
export function ScoreGauge({
  value,
  max = 100,
  size = 280,
}: {
  value: number;
  max?: number;
  size?: number;
}) {
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // semicircle from 180deg to 360deg (top half)
  const start = Math.PI;
  const end = 2 * Math.PI;
  const frac = Math.max(0, Math.min(1, value / max));

  const polar = (angle: number) => [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  const [sx, sy] = polar(start);
  const [ex, ey] = polar(end);
  const valAngle = start + (end - start) * frac;
  const [vx, vy] = polar(valAngle);

  const arc = (x1: number, y1: number, x2: number, y2: number, large: number) =>
    `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;

  const color =
    value >= 60 ? "var(--color-green)" : value >= 45 ? "var(--color-orange)" : "var(--color-red)";

  return (
    <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
      <path
        d={arc(sx, sy, ex, ey, 1)}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <path
        d={arc(sx, sy, vx, vy, frac > 0.5 ? 1 : 0)}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        className="font-mono"
        fontSize={48}
        fontWeight={700}
        fill="var(--color-ink)"
      >
        {value}
      </text>
      <text
        x={cx}
        y={cy + 18}
        textAnchor="middle"
        className="font-mono"
        fontSize={15}
        fill="var(--color-muted)"
      >
        /{max}
      </text>
    </svg>
  );
}

// Compact 0-100 mini gauge (the 6-up dashboard tiles on cockpit).
export function MiniGauge({
  label,
  value,
  caption,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  tone: "green" | "orange" | "red";
}) {
  const color =
    tone === "green"
      ? "var(--color-green)"
      : tone === "orange"
        ? "var(--color-orange)"
        : "var(--color-red)";
  return (
    <div className="rounded-lg border border-dashed border-line p-3">
      <div className="font-serif text-[13px] text-muted">{label}</div>
      <div className="my-1 font-mono text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="h-1.5 w-full rounded bg-panel-2">
        <div
          className="h-1.5 rounded"
          style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
      </div>
      <div className="mt-1.5 text-[12px] text-muted">{caption}</div>
    </div>
  );
}
