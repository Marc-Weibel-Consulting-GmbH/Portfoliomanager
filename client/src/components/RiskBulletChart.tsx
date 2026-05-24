interface BulletChartProps {
  title: string;
  subtitle: string; // e.g. "Niedriger ist besser"
  value: number;
  benchmarkValue: number | null;
  min: number;
  max: number;
  /** Thresholds for color zones: [goodEnd, mediumEnd] — rest is bad */
  zones: [number, number];
  suffix?: string;
  invertColors?: boolean; // if true, lower values are better (default)
}

export default function BulletChart({
  title,
  subtitle,
  value,
  benchmarkValue,
  min,
  max,
  zones,
  suffix = "%",
  invertColors = true,
}: BulletChartProps) {
  const range = max - min;
  const valuePos = Math.max(0, Math.min(100, ((value - min) / range) * 100));
  const benchmarkPos = benchmarkValue !== null
    ? Math.max(0, Math.min(100, ((benchmarkValue - min) / range) * 100))
    : null;

  // Zone widths as percentages
  const zone1End = ((zones[0] - min) / range) * 100;
  const zone2End = ((zones[1] - min) / range) * 100;

  // Colors: for "lower is better", first zone is good (dark teal), second is medium (amber), third is bad (olive)
  const goodColor = invertColors ? "bg-teal-700/60" : "bg-emerald-600/40";
  const mediumColor = "bg-amber-600/30";
  const badColor = invertColors ? "bg-emerald-900/30" : "bg-teal-700/60";

  const diff = benchmarkValue !== null ? value - benchmarkValue : null;
  const diffStr = diff !== null
    ? `${diff >= 0 ? "+" : ""}${diff.toFixed(2)} pp vs. Benchmark`
    : null;

  return (
    <div className="p-4 rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>

      {/* Bullet bar */}
      <div className="relative h-5 rounded-sm overflow-hidden flex">
        {/* Zone backgrounds */}
        <div className={`${goodColor} h-full`} style={{ width: `${zone1End}%` }} />
        <div className={`${mediumColor} h-full`} style={{ width: `${zone2End - zone1End}%` }} />
        <div className={`${badColor} h-full`} style={{ width: `${100 - zone2End}%` }} />

        {/* Portfolio value bar */}
        <div
          className="absolute top-0 left-0 h-full bg-blue-500/80 rounded-sm"
          style={{ width: `${valuePos}%` }}
        />

        {/* Benchmark marker */}
        {benchmarkPos !== null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-foreground"
            style={{ left: `${benchmarkPos}%` }}
          />
        )}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">{min}</span>
        <span className="text-[10px] text-muted-foreground">{zones[0]}</span>
        <span className="text-[10px] text-muted-foreground">{zones[1]}</span>
        <span className="text-[10px] text-muted-foreground">{max}</span>
      </div>

      {/* Values */}
      <div className="mt-2">
        <span className="text-lg font-bold">{value.toFixed(1)} {suffix}</span>
        {benchmarkValue !== null && (
          <span className="text-xs text-muted-foreground ml-2">
            Benchmark: {benchmarkValue.toFixed(1)} {suffix}
          </span>
        )}
      </div>
      {diffStr && (
        <p className={`text-xs mt-0.5 ${
          (invertColors && diff! > 0) || (!invertColors && diff! < 0)
            ? "text-red-400"
            : "text-green-400"
        }`}>
          {diffStr}
        </p>
      )}
    </div>
  );
}
