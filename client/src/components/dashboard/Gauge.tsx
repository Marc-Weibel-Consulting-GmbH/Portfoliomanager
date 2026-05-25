// Semi-circle gauge for the LPPL bubble indicator (0..100).
// Custom SVG with improved visual design — gradient arcs, glow effects,
// and better proportions for a more polished dashboard look.

interface GaugeProps {
  /** Current value, 0..max */
  value: number;
  max?: number;
  size?: number;
  /** Color of the value arc (usually the dashboard accent) */
  color?: string;
  /** Label below the number */
  label?: string;
  /** Background segments (low/medium/high zones) */
  segments?: { from: number; to: number; color: string }[];
  /** Visual surface — controls track color and text */
  surface?: {
    text: string;
    textMuted: string;
    grid: string;
  };
}

const DEFAULT_SURFACE = {
  text: "#ffffff",
  textMuted: "#9ca3af",
  grid: "rgba(255,255,255,0.08)",
};

export function Gauge({
  value,
  max = 100,
  size = 160,
  color = "#00CFC1",
  label,
  segments,
  surface = DEFAULT_SURFACE,
}: GaugeProps) {
  const cx = size / 2;
  const cy = size * 0.72;
  const r = size * 0.38;
  const strokeWidth = size * 0.07;
  const start = Math.PI;      // left edge (180°)
  const end = 0;              // right edge (0°)
  const valuePct = Math.max(0, Math.min(1, value / max));

  const arcPath = (a0: number, a1: number, radius = r) => {
    const x0 = cx + radius * Math.cos(a0);
    const y0 = cy + radius * Math.sin(-a0);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(-a1);
    const largeArc = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const valueAngle = start - (start - end) * valuePct;

  // Needle tip position
  const needleLen = r - 6;
  const needleX = cx + needleLen * Math.cos(valueAngle);
  const needleY = cy + needleLen * Math.sin(-valueAngle);

  // Tick marks
  const ticks = [0, 25, 50, 75, 100];

  return (
    <div
      style={{ position: "relative", width: size, height: size * 0.82 }}
      className="select-none"
    >
      <svg
        width={size}
        height={size * 0.82}
        viewBox={`0 0 ${size} ${size * 0.82}`}
        style={{ display: "block" }}
      >
        {/* Outer glow */}
        <defs>
          <filter id="gauge-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Track background */}
        <path
          d={arcPath(start, end)}
          fill="none"
          stroke={surface.grid}
          strokeWidth={strokeWidth + 2}
          strokeLinecap="round"
        />

        {/* Zone segments (low/medium/high) */}
        {segments?.map((seg, i) => {
          const a0 = start - (start - end) * (seg.from / max);
          const a1 = start - (start - end) * (seg.to / max);
          return (
            <path
              key={i}
              d={arcPath(a0, a1)}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              opacity="0.6"
            />
          );
        })}

        {/* Value arc with glow */}
        {valuePct > 0.01 && (
          <path
            d={arcPath(start, valueAngle)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter="url(#gauge-glow)"
            opacity="0.9"
          />
        )}

        {/* Tick marks */}
        {ticks.map(t => {
          const angle = start - (start - end) * (t / max);
          const outerR = r + strokeWidth / 2 + 3;
          const innerR = r + strokeWidth / 2 + 8;
          return (
            <line
              key={t}
              x1={cx + outerR * Math.cos(angle)}
              y1={cy + outerR * Math.sin(-angle)}
              x2={cx + innerR * Math.cos(angle)}
              y2={cy + innerR * Math.sin(-angle)}
              stroke={surface.textMuted}
              strokeWidth="1"
              opacity="0.5"
            />
          );
        })}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke={surface.text}
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.9"
        />
        {/* Center dot */}
        <circle cx={cx} cy={cy} r="3.5" fill={color} stroke={surface.text} strokeWidth="1" />
      </svg>

      {/* Value + label overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: size * 0.18,
            fontWeight: 700,
            color: color,
            lineHeight: 1,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {value}
          <span
            style={{
              fontSize: size * 0.09,
              color: surface.textMuted,
              marginLeft: 2,
            }}
          >
            /{max}
          </span>
        </div>
        {label && (
          <div
            style={{
              fontSize: 9,
              color: surface.textMuted,
              marginTop: 2,
              letterSpacing: 0.5,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
        )}
      </div>
    </div>
  );
}
