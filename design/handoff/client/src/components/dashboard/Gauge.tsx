// Semi-circle gauge for the LPPL bubble indicator (0..100).
// Custom SVG — recharts has RadialBarChart but the API for traffic-light
// segments + a needle is harder than just drawing it.

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
  grid: "rgba(255,255,255,0.05)",
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
  const cy = size * 0.78;
  const r = size * 0.42;
  const start = Math.PI;      // left edge (180°)
  const end = 0;              // right edge (0°)
  const valuePct = Math.max(0, Math.min(1, value / max));

  const arcPath = (a0: number, a1: number, radius = r) => {
    const x0 = cx + radius * Math.cos(a0);
    const y0 = cy + radius * Math.sin(-a0);
    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(-a1);
    return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };

  const valueAngle = start - (start - end) * valuePct;

  return (
    <div
      style={{ position: "relative", width: size, height: size * 0.88 }}
      className="select-none"
    >
      <svg
        width={size}
        height={size * 0.88}
        viewBox={`0 0 ${size} ${size * 0.88}`}
        style={{ display: "block" }}
      >
        {/* Track */}
        <path d={arcPath(start, end)} fill="none" stroke={surface.grid} strokeWidth="10" strokeLinecap="round" />

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
              strokeWidth="10"
              strokeLinecap="butt"
              opacity="0.7"
            />
          );
        })}

        {/* Value arc */}
        <path
          d={arcPath(start, valueAngle)}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={cx + (r - 4) * Math.cos(valueAngle)}
          y2={cy + (r - 4) * Math.sin(-valueAngle)}
          stroke={surface.text}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={surface.text} />
      </svg>

      {/* Value + label overlay */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: size * 0.3,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontSize: size * 0.22,
            fontWeight: 600,
            color: surface.text,
            lineHeight: 1,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          {value}
          <span
            style={{
              fontSize: size * 0.1,
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
              fontSize: 10,
              color: surface.textMuted,
              marginTop: 4,
              letterSpacing: 0.3,
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
