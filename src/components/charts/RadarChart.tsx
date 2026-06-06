interface Axis {
  label: string;
  value: number; // 0-100 (favorability)
}

export function RadarChart({
  axes,
  size = 420,
}: {
  axes: Axis[];
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
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
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        {/* Radar Sweep Animation */}
      <div 
        className="absolute rounded-full pointer-events-none mix-blend-screen"
        style={{
          width: r * 2,
          height: r * 2,
          background: 'conic-gradient(from 0deg, transparent 70%, rgba(79, 70, 229, 0.15) 90%, rgba(79, 70, 229, 0.6) 100%)',
          animation: 'spin 4s linear infinite',
        }}
      />

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <defs>
          <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-blue)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--color-blue)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.1" />
          </linearGradient>
          <style>{`
            @keyframes radar-pulse {
              0%, 100% { transform: scale(1); opacity: 0.6; }
              50% { transform: scale(1.4); opacity: 1; }
            }
            .radar-center {
              transform-origin: ${cx}px ${cy}px;
              animation: radar-pulse 3s ease-in-out infinite;
            }
            .radar-polygon {
              stroke-dasharray: 2000;
              stroke-dashoffset: 2000;
              animation: draw-polygon 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
            @keyframes draw-polygon {
              to { stroke-dashoffset: 0; }
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes spin-reverse {
              from { transform: rotate(360deg); }
              to { transform: rotate(0deg); }
            }
          `}</style>
        </defs>
        
        {/* Tech Crosshairs */}
        <line x1={cx} y1={size * 0.05} x2={cx} y2={size * 0.95} stroke="var(--color-blue)" strokeWidth={1} className="opacity-20" strokeDasharray="4 4" />
        <line x1={size * 0.05} y1={cy} x2={size * 0.95} y2={cy} stroke="var(--color-blue)" strokeWidth={1} className="opacity-20" strokeDasharray="4 4" />
        
        {/* Outer Decorative Rings */}
        <circle cx={cx} cy={cy} r={size * 0.42} fill="none" stroke="var(--color-blue)" strokeWidth={1} strokeDasharray="2 8" className="opacity-30" style={{ animation: 'spin 20s linear infinite', transformOrigin: `${cx}px ${cy}px` }} />
        <circle cx={cx} cy={cy} r={size * 0.46} fill="none" stroke="var(--color-blue)" strokeWidth={1} strokeDasharray="1 6" className="opacity-20" style={{ animation: 'spin-reverse 30s linear infinite', transformOrigin: `${cx}px ${cy}px` }} />
        
        {/* Random Blips */}
        <g className="opacity-60">
          <circle cx={cx + r * 0.8} cy={cy - r * 0.5} r={2} fill="var(--color-blue)" className="animate-pulse" style={{ animationDuration: '3s' }} />
          <circle cx={cx - r * 0.6} cy={cy + r * 0.7} r={1.5} fill="var(--color-blue)" className="animate-pulse" style={{ animationDuration: '2s', animationDelay: '1s' }} />
          <circle cx={cx + r * 0.3} cy={cy + r * 0.8} r={2.5} fill="var(--color-blue)" className="animate-pulse" style={{ animationDuration: '4s', animationDelay: '0.5s' }} />
          <circle cx={cx - r * 0.8} cy={cy - r * 0.2} r={1.5} fill="var(--color-blue)" className="animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '1.5s' }} />
        </g>

        {rings.map((frac, ri) => (
          <circle
            key={ri}
            cx={cx}
            cy={cy}
            r={r * frac}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={1}
            strokeDasharray={ri === rings.length - 1 ? "none" : "4 4"}
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
              strokeDasharray="4 4"
            />
          );
        })}
        
        <polygon
          points={valuePts}
          fill="url(#radar-fill)"
          stroke="#06b6d4"
          strokeWidth={2}
          className="radar-polygon"
        />
        
        <circle cx={cx} cy={cy} r={size * 0.12} fill="url(#radar-glow)" className="radar-center" />
        <circle cx={cx} cy={cy} r={4} fill="#fff" stroke="#06b6d4" strokeWidth={2} />
        
        {/* Data Points */}
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, a.value / 100);
          const colors = ["#0ea5e9", "#8b5cf6", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6"];
          return (
            <g key={i} className="transition-transform duration-500 hover:scale-125" style={{ transformOrigin: `${x}px ${y}px` }}>
              <circle cx={x} cy={y} r={6} fill="#fff" stroke={colors[i % colors.length]} strokeWidth={2} />
              <circle cx={x} cy={y} r={2.5} fill={colors[i % colors.length]} className="animate-pulse" style={{ animationDuration: '2s' }} />
            </g>
          );
        })}
        
        {axes.map((a, i) => {
          const [x, y] = pointAt(i, 1.25);
          return (
            <g key={`text-${i}`}>
              <text
                x={x}
                y={y - 8}
                textAnchor="middle"
                className="font-sans font-medium"
                fontSize={14}
                fill="var(--color-ink)"
              >
                {a.label}
              </text>
              <text
                x={x}
                y={y + 10}
                textAnchor="middle"
                className="font-sans"
                fontSize={13}
                fill="var(--color-muted)"
              >
                机会指数 {a.value}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
