// Custom SVG treemap of holdings. Tile size = weight, tile color = YTD
// performance heat (red → green via OKLCH so it stays perceptually even
// across both dark and light themes).
//
// We deliberately don't use recharts' Treemap — it draws all tiles in a
// single color and doesn't expose enough hooks for the heat coloring + the
// monospaced label tagging we want here.

import type { Holding } from "./types";
import { formatPercent } from "./format";
import { useLocation } from "wouter";

interface TreemapTile extends Holding {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Squarified-ish layout — greedy rows, flushed every ~3 items or when
 * one would dominate. Cheap, deterministic, good enough for ≤30 holdings. */
function layoutTreemap(items: Holding[], width: number, height: number): TreemapTile[] {
  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const total = sorted.reduce((s, x) => s + x.weight, 0);
  const result: TreemapTile[] = [];

  let x = 0, y = 0, remW = width, remH = height;
  let row: Holding[] = [];
  let rowVal = 0;
  let horizontal = width >= height;

  const flushRow = () => {
    if (!row.length) return;
    if (horizontal) {
      const rowW = (rowVal / total) * width;
      let cy = y;
      for (const it of row) {
        const ih = (it.weight / rowVal) * remH;
        result.push({ ...it, x, y: cy, w: rowW, h: ih });
        cy += ih;
      }
      x += rowW;
      remW -= rowW;
    } else {
      const rowH = (rowVal / total) * height;
      let cx = x;
      for (const it of row) {
        const iw = (it.weight / rowVal) * remW;
        result.push({ ...it, x: cx, y, w: iw, h: rowH });
        cx += iw;
      }
      y += rowH;
      remH -= rowH;
    }
    row = [];
    rowVal = 0;
    horizontal = remW >= remH;
  };

  for (const it of sorted) {
    row.push(it);
    rowVal += it.weight;
    if (row.length >= 3 || it.weight / total > 0.1) flushRow();
  }
  flushRow();
  return result;
}

interface PositionsTreemapProps {
  holdings: Holding[];
  width?: number;
  height?: number;
  dark?: boolean;
  bgColor: string;
  textColor: string;
  mutedColor: string;
  cardAltColor: string;
}

export function PositionsTreemap({
  holdings,
  width = 1100,
  height = 380,
  dark = true,
  bgColor,
  textColor,
  mutedColor,
  cardAltColor,
}: PositionsTreemapProps) {
  const [, setLocation] = useLocation();
  const tiles = layoutTreemap(holdings, width, height);

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ display: "block", borderRadius: 8 }}
      >
        {tiles.map(t => {
          const intensity = Math.min(1, Math.abs(t.ytd) / 30);
          const fill =
            t.ytd >= 0
              ? `oklch(${dark ? 0.5 - intensity * 0.18 : 0.92 - intensity * 0.3} 0.13 165)`
              : `oklch(${dark ? 0.45 - intensity * 0.1 : 0.92 - intensity * 0.3} 0.15 25)`;

          return (
            <g key={t.ticker} className="cursor-pointer" onClick={() => t.ticker !== 'CASH' && setLocation(`/aktien/${t.ticker}`)}>
              <rect
                x={t.x + 1}
                y={t.y + 1}
                width={t.w - 2}
                height={t.h - 2}
                fill={fill}
                stroke={bgColor}
                strokeWidth="2"
                rx="3"
              />
              {t.w > 50 && t.h > 30 && (
                <>
                  <text
                    x={t.x + 8}
                    y={t.y + 16}
                    fill={textColor}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="ui-monospace, monospace"
                  >
                    {t.ticker}
                  </text>
                  {t.h > 50 && (
                    <text
                      x={t.x + 8}
                      y={t.y + 30}
                      fill={textColor}
                      opacity="0.7"
                      fontSize="9"
                    >
                      {t.weight.toFixed(1)}%
                    </text>
                  )}
                  {t.h > 70 && (
                    <text
                      x={t.x + 8}
                      y={t.y + t.h - 8}
                      fill={textColor}
                      fontSize="11"
                      fontWeight="600"
                      fontFamily="ui-monospace, monospace"
                    >
                      {formatPercent(t.ytd, 1)}
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-2 mt-3 text-[10px] font-mono" style={{ color: mutedColor }}>
        <span>-20%</span>
        <div
          style={{
            width: 200,
            height: 8,
            borderRadius: 99,
            background: `linear-gradient(to right, ${dark ? "oklch(0.35 0.15 25)" : "oklch(0.62 0.21 25)"}, ${cardAltColor}, ${dark ? "oklch(0.32 0.13 165)" : "oklch(0.62 0.16 165)"})`,
          }}
        />
        <span>+30%</span>
      </div>
    </div>
  );
}
