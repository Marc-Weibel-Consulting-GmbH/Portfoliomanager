// Positions as a packed-circle "constellation". Each holding is a circle
// — area ∝ weight, fill = sector color, a soft halo marks strong YTD
// performers. The layout is a greedy spiral from the center outward, so
// the heaviest position lands in the middle.
//
// No off-the-shelf chart library does this cleanly, so it's hand-rolled
// SVG. Layout runs in useMemo so it's stable across renders.

import * as React from "react";
import type { Holding } from "./types";

interface PackedHolding extends Holding {
  x: number;
  y: number;
  radius: number;
}

function packCircles(items: Holding[], width: number, height: number): PackedHolding[] {
  const cx = width / 2;
  const cy = height / 2;
  const placed: PackedHolding[] = [];
  const sorted = [...items].sort((a, b) => b.weight - a.weight);

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const radius = 6 + Math.sqrt(p.weight) * 12;

    if (i === 0) {
      placed.push({ ...p, x: cx, y: cy, radius });
      continue;
    }

    let placedOk = false;
    for (let step = 0; step < 1200 && !placedOk; step++) {
      const t = step * 0.18;
      const dist = 6 + step * 0.7;
      const x = cx + Math.cos(t + i * 1.7) * dist;
      const y = cy + Math.sin(t + i * 1.7) * dist;
      const fits =
        placed.every(q => {
          const dx = x - q.x;
          const dy = y - q.y;
          return Math.sqrt(dx * dx + dy * dy) >= q.radius + radius + 3;
        }) &&
        x > radius + 4 &&
        x < width - radius - 4 &&
        y > radius + 4 &&
        y < height - radius - 4;
      if (fits) {
        placed.push({ ...p, x, y, radius });
        placedOk = true;
      }
    }
    if (!placedOk) {
      placed.push({
        ...p,
        x: 24 + Math.random() * (width - 48),
        y: 24 + Math.random() * (height - 48),
        radius: radius * 0.8,
      });
    }
  }
  return placed;
}

interface PositionsConstellationProps {
  holdings: Holding[];
  width?: number;
  height?: number;
  dark?: boolean;
  textColor: string;
  positiveColor: string;
}

export function PositionsConstellation({
  holdings,
  width = 1100,
  height = 420,
  dark = true,
  textColor,
  positiveColor,
}: PositionsConstellationProps) {
  const packed = React.useMemo(
    () => packCircles(holdings, width, height),
    [holdings, width, height],
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ display: "block" }}
    >
      <defs>
        {packed.map((p, i) => (
          <radialGradient
            key={`glow-${p.ticker}`}
            id={`glow-${i}`}
            cx="50%"
            cy="50%"
          >
            <stop
              offset="0%"
              stopColor={p.color ?? "#888"}
              stopOpacity={p.ticker === "CASH" ? 0.3 : 0.95}
            />
            <stop
              offset="70%"
              stopColor={p.color ?? "#888"}
              stopOpacity={p.ticker === "CASH" ? 0.15 : 0.55}
            />
            <stop offset="100%" stopColor={p.color ?? "#888"} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>

      {/* Halo rings around high-performing positions */}
      {packed.map(
        (p, i) =>
          p.ytd > 15 && (
            <circle
              key={`halo-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.radius + 6}
              fill="none"
              stroke={positiveColor}
              strokeWidth="1"
              opacity={Math.min(0.5, p.ytd / 50)}
            />
          ),
      )}

      {/* Position bubbles */}
      {packed.map((p, i) => (
        <g key={p.ticker}>
          <circle
            cx={p.x}
            cy={p.y}
            r={p.radius}
            fill={`url(#glow-${i})`}
            stroke={p.color ?? "#888"}
            strokeWidth={dark ? 1 : 1.5}
            strokeOpacity={0.8}
          />
          {p.radius > 18 && (
            <text
              x={p.x}
              y={p.y + 2}
              textAnchor="middle"
              fontSize={Math.min(11, p.radius * 0.45)}
              fill={textColor}
              fontFamily="ui-monospace, monospace"
              fontWeight="600"
            >
              {p.ticker.split(".")[0]}
            </text>
          )}
          {p.radius > 26 && (
            <text
              x={p.x}
              y={p.y + 14}
              textAnchor="middle"
              fontSize="8"
              fill={textColor}
              opacity="0.7"
              fontFamily="ui-monospace, monospace"
            >
              {p.weight.toFixed(1)}%
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}
