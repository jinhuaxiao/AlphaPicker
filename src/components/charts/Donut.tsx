interface Slice {
  label: string;
  value: number; // percentage points
  color: string;
}

export function Donut({
  slices,
  centerTop,
  centerBottom,
  size = 200,
}: {
  slices: Slice[];
  centerTop: string;
  centerBottom?: string;
  size?: number;
}) {
  const stroke = 26;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const total = slices.reduce((a, s) => a + s.value, 0) || 100;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {slices.map((s, i) => {
            const len = (s.value / total) * circ;
            const el = (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${circ - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text
          x={cx}
          y={cy - 2}
          textAnchor="middle"
          className="font-mono"
          fontSize={26}
          fontWeight={700}
          fill="var(--color-ink)"
        >
          {centerTop}
        </text>
        {centerBottom ? (
          <text
            x={cx}
            y={cy + 20}
            textAnchor="middle"
            className="font-serif"
            fontSize={13}
            fill="var(--color-muted)"
          >
            {centerBottom}
          </text>
        ) : null}
      </svg>
      <ul className="space-y-2">
        {slices.map((s, i) => (
          <li key={i} className="flex items-center gap-2 text-[15px] font-serif">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label} {s.value}%
          </li>
        ))}
      </ul>
    </div>
  );
}
