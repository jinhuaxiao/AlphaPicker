interface Axis {
  label: string;
  value: number; // 0-100 (favorability)
}

export function RadarChart({
  axes,
  size = 320,
}: {
  axes: Axis[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = axes.length;

  const pointAt = (i: number, frac: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r * frac, cy + Math.sin(angle) * r * frac];
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const valuePts = axes
    .map((a, i) => pointAt(i, a.value / 100).join(","))
    .join(" ");

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((frac, ri) => (
        <polygon
          key={ri}
          points={axes.map((_, i) => pointAt(i, frac).join(",")).join(" ")}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={1}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pointAt(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--color-line)"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={valuePts}
        fill="var(--color-blue)"
        fillOpacity={0.18}
        stroke="var(--color-blue)"
        strokeWidth={2}
      />
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, a.value / 100);
        return <circle key={i} cx={x} cy={y} r={3.5} fill="var(--color-blue)" />;
      })}
      {axes.map((a, i) => {
        const [x, y] = pointAt(i, 1.18);
        return (
          <text
            key={i}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="font-serif"
            fontSize={13}
            fill="var(--color-ink)"
          >
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}
