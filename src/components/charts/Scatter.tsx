interface Dot {
  x: number; // 0..1 risk (left = low risk)
  y: number; // 0..1 return (top = high)
  size: number;
  zone: "gold" | "chance" | "steady" | "avoid";
}

const ZONE_FILL: Record<Dot["zone"], string> = {
  gold: "#9bbf8f",
  chance: "#d2a86a",
  steady: "#b3ad99",
  avoid: "#cf9b93",
};

export function ScatterQuadrant({
  candidates,
  product,
  width = 560,
  height = 380,
}: {
  candidates: Dot[];
  product: { x: number; y: number };
  width?: number;
  height?: number;
}) {
  const pad = { l: 48, r: 16, t: 32, b: 40 };
  const W = width - pad.l - pad.r;
  const H = height - pad.t - pad.b;
  const px = (x: number) => pad.l + x * W;
  const py = (y: number) => pad.t + (1 - y) * H;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* quadrant backgrounds */}
      <rect x={pad.l} y={pad.t} width={W / 2} height={H / 2} fill="#dcebd9" />
      <rect x={pad.l + W / 2} y={pad.t} width={W / 2} height={H / 2} fill="#f6e6cf" />
      <rect x={pad.l} y={pad.t + H / 2} width={W / 2} height={H / 2} fill="#eeece0" />
      <rect x={pad.l + W / 2} y={pad.t + H / 2} width={W / 2} height={H / 2} fill="#f6dcd7" />

      {/* axes */}
      <line x1={pad.l} y1={pad.t} x2={pad.l} y2={pad.t + H} stroke="var(--color-ink)" />
      <line x1={pad.l} y1={pad.t + H} x2={pad.l + W} y2={pad.t + H} stroke="var(--color-ink)" />

      {/* zone labels */}
      <text x={pad.l + W * 0.25} y={pad.t + 18} textAnchor="middle" fontSize={14} fill="var(--color-green)" className="font-serif">黄金区</text>
      <text x={pad.l + W * 0.25} y={pad.t + 34} textAnchor="middle" fontSize={11} fill="var(--color-muted)" className="font-serif">低风险 · 高回报</text>
      <text x={pad.l + W * 0.75} y={pad.t + 18} textAnchor="middle" fontSize={14} fill="var(--color-orange)" className="font-serif">机会区</text>
      <text x={pad.l + W * 0.75} y={pad.t + 34} textAnchor="middle" fontSize={11} fill="var(--color-muted)" className="font-serif">高风险 · 高回报</text>
      <text x={pad.l + W * 0.25} y={pad.t + H - 10} textAnchor="middle" fontSize={14} fill="var(--color-muted)" className="font-serif">稳健区</text>
      <text x={pad.l + W * 0.75} y={pad.t + H - 10} textAnchor="middle" fontSize={14} fill="var(--color-red)" className="font-serif">避让区</text>

      {/* candidates */}
      {candidates.map((d, i) => (
        <circle
          key={i}
          cx={px(d.x)}
          cy={py(d.y)}
          r={d.size}
          fill={ZONE_FILL[d.zone]}
          fillOpacity={0.85}
          stroke="var(--color-ink)"
          strokeOpacity={0.25}
        />
      ))}

      {/* the product */}
      <g transform={`translate(${px(product.x)} ${py(product.y)})`}>
        <circle r={16} fill="var(--color-blue)" fillOpacity={0.18} />
        <path
          d="M0,-11 L3.2,-3.5 L11,-3.5 L4.8,1.5 L7,9 L0,4.5 L-7,9 L-4.8,1.5 L-11,-3.5 L-3.2,-3.5 Z"
          fill="var(--color-blue)"
        />
        <text x={20} y={5} fontSize={13} fill="var(--color-blue)" className="font-serif">你的产品</text>
      </g>

      {/* axis titles */}
      <text x={pad.l + W / 2} y={height - 6} textAnchor="middle" fontSize={12} fill="var(--color-muted)" className="font-serif">风险综合分 →</text>
      <text
        x={14}
        y={pad.t + H / 2}
        textAnchor="middle"
        fontSize={12}
        fill="var(--color-muted)"
        className="font-serif"
        transform={`rotate(-90 14 ${pad.t + H / 2})`}
      >
        ← 预期年化 ROI %
      </text>
    </svg>
  );
}
