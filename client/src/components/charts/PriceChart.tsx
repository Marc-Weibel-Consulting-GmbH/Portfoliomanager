import { useEffect, useMemo, useRef } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  AreaSeries,
  LineSeries,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
} from "lightweight-charts";

/**
 * Wiederverwendbare Kurs-/Performance-Chart-Komponente auf Basis von
 * TradingView lightweight-charts (Apache-2.0, ~45 kB, framework-agnostisch).
 *
 * Ergaenzt die bestehenden recharts-Dashboard-Charts um echte Finanz-Charts
 * (Candlesticks mit Volumen, logarithmische Skala, Crosshair) — siehe
 * GitHub-Empfehlungen, Paket "Frontend-Charts".
 *
 * Farbgebung bewusst gesaettigt-arm (Projekt-Standard). Alle Farben koennen
 * ueber `colors` ueberschrieben werden.
 */

export interface OhlcPoint {
  time: Time; // "YYYY-MM-DD" oder Unix-Timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface ValuePoint {
  time: Time;
  value: number;
}

export interface PriceChartColors {
  upColor?: string;
  downColor?: string;
  lineColor?: string;
  areaTopColor?: string;
  areaBottomColor?: string;
  volumeColor?: string;
  gridColor?: string;
  textColor?: string;
}

export interface PriceChartProps {
  /** Candlestick-Daten (seriesType="candlestick") */
  ohlc?: OhlcPoint[];
  /** Linien-/Flaechen-Daten (seriesType="line" | "area") */
  values?: ValuePoint[];
  seriesType?: "candlestick" | "line" | "area";
  height?: number;
  /** Volumen-Histogramm unter dem Chart (nur bei candlestick mit volume) */
  showVolume?: boolean;
  /** Logarithmische Preisskala — sinnvoll fuer lange Zeitraeume */
  logScale?: boolean;
  colors?: PriceChartColors;
  className?: string;
}

const DEFAULT_COLORS: Required<PriceChartColors> = {
  upColor: "#4e9a79",
  downColor: "#c26a5a",
  lineColor: "#6b7f99",
  areaTopColor: "rgba(110, 143, 171, 0.28)",
  areaBottomColor: "rgba(110, 143, 171, 0.04)",
  volumeColor: "rgba(148, 163, 184, 0.35)",
  gridColor: "rgba(148, 163, 184, 0.12)",
  textColor: "#64748b",
};

export function PriceChart({
  ohlc,
  values,
  seriesType = "area",
  height = 320,
  showVolume = false,
  logScale = false,
  colors,
  className,
}: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const palette = { ...DEFAULT_COLORS, ...colors };
  const dataKey = useMemo(
    () => JSON.stringify({ ohlc, values, colors }),
    [ohlc, values, colors]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: palette.textColor,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: palette.gridColor },
        horzLines: { color: palette.gridColor },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: {
        borderVisible: false,
        mode: logScale ? 1 : 0, // 1 = logaritmisch
      },
      timeScale: { borderVisible: false, timeVisible: true },
    });
    chartRef.current = chart;

    if (seriesType === "candlestick" && ohlc && ohlc.length > 0) {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: palette.upColor,
        downColor: palette.downColor,
        wickUpColor: palette.upColor,
        wickDownColor: palette.downColor,
        borderVisible: false,
      });
      series.setData(
        ohlc.map(p => ({
          time: p.time,
          open: p.open,
          high: p.high,
          low: p.low,
          close: p.close,
        }))
      );

      if (showVolume && ohlc.some(p => p.volume != null)) {
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: "volume",
          priceFormat: { type: "volume" },
        });
        chart.priceScale("volume").applyOptions({
          scaleMargins: { top: 0.8, bottom: 0 },
        });
        volumeSeries.setData(
          ohlc
            .filter(p => p.volume != null)
            .map(p => ({
              time: p.time,
              value: p.volume as number,
              color:
                p.close >= p.open
                  ? "rgba(78, 154, 121, 0.4)"
                  : "rgba(194, 106, 90, 0.4)",
            }))
        );
      }
    } else if (values && values.length > 0) {
      if (seriesType === "line") {
        const series = chart.addSeries(LineSeries, {
          color: palette.lineColor,
          lineWidth: 2,
        });
        series.setData(values);
      } else {
        const series = chart.addSeries(AreaSeries, {
          lineColor: palette.lineColor,
          topColor: palette.areaTopColor,
          bottomColor: palette.areaBottomColor,
          lineWidth: 2,
        });
        series.setData(values);
      }
    }

    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
    // Daten/Serientyp-Wechsel bauen den Chart neu auf (einfachstes korrektes Verhalten).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, seriesType, height, showVolume, logScale]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: "100%", height }}
      data-testid="price-chart"
    />
  );
}
