import { useEffect, useRef, memo } from "react";

interface TradingViewWidgetProps {
  widgetType: string;
  config: Record<string, unknown>;
  height?: number;
  className?: string;
}

/**
 * Generic TradingView Widget component.
 * Embeds any TradingView widget by injecting the external script.
 */
function TradingViewWidgetInner({ widgetType, config, height = 500, className = "" }: TradingViewWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous content
    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    widgetContainer.style.height = `${height}px`;
    widgetContainer.style.width = "100%";
    containerRef.current.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${widgetType}.js`;
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      ...config,
      width: "100%",
      height: height,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [widgetType, JSON.stringify(config), height]);

  return (
    <div
      ref={containerRef}
      className={`tradingview-widget-container ${className}`}
      style={{ height: `${height}px`, width: "100%" }}
    />
  );
}

export const TradingViewWidget = memo(TradingViewWidgetInner);

// Pre-configured widget configs for common use cases

export const MARKET_OVERVIEW_CONFIG = {
  colorTheme: "dark",
  dateRange: "12M",
  locale: "de_DE",
  isTransparent: true,
  showFloatingTooltip: true,
  plotLineColorGrowing: "#00CFC1",
  plotLineColorFalling: "#ef4444",
  gridLineColor: "rgba(240, 243, 250, 0)",
  scaleFontColor: "#DBDBDB",
  belowLineFillColorGrowing: "rgba(0, 207, 193, 0.12)",
  belowLineFillColorFalling: "rgba(239, 68, 68, 0.12)",
  belowLineFillColorGrowingBottom: "rgba(0, 207, 193, 0)",
  belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)",
  symbolActiveColor: "rgba(0, 207, 193, 0.05)",
  tabs: [
    {
      title: "Schweiz",
      symbols: [
        { s: "SIX:NESN", d: "Nestlé" },
        { s: "SIX:NOVN", d: "Novartis" },
        { s: "SIX:ROG", d: "Roche" },
        { s: "SIX:UBSG", d: "UBS Group" },
        { s: "SIX:ZURN", d: "Zurich Insurance" },
        { s: "SIX:ABBN", d: "ABB" },
      ],
    },
    {
      title: "Europa",
      symbols: [
        { s: "XETR:SAP", d: "SAP" },
        { s: "XETR:SIE", d: "Siemens" },
        { s: "EURONEXT:MC", d: "LVMH" },
        { s: "XETR:ALV", d: "Allianz" },
        { s: "LSE:SHEL", d: "Shell" },
        { s: "EURONEXT:OR", d: "L'Oréal" },
      ],
    },
    {
      title: "USA",
      symbols: [
        { s: "NASDAQ:AAPL", d: "Apple" },
        { s: "NASDAQ:MSFT", d: "Microsoft" },
        { s: "NASDAQ:GOOGL", d: "Alphabet" },
        { s: "NASDAQ:AMZN", d: "Amazon" },
        { s: "NASDAQ:NVDA", d: "NVIDIA" },
        { s: "NASDAQ:META", d: "Meta" },
      ],
    },
  ],
};

export const HEATMAP_CONFIG = {
  colorTheme: "dark",
  locale: "de_DE",
  isTransparent: true,
  dataSource: "SPX500",
  grouping: "sector",
  blockSize: "market_cap_basic",
  blockColor: "change",
  hasTopBar: true,
  symbolUrl: "",
};

export const TECHNICAL_ANALYSIS_CONFIG = {
  colorTheme: "dark",
  locale: "de_DE",
  isTransparent: true,
  showIntervalTabs: true,
  interval: "1D",
  displayMode: "multiple",
};

export const ADVANCED_CHART_CONFIG = {
  autosize: true,
  symbol: "SIX:NESN",
  interval: "D",
  timezone: "Europe/Zurich",
  theme: "dark",
  style: "1",
  locale: "de_DE",
  allow_symbol_change: true,
  calendar: false,
  support_host: "https://www.tradingview.com",
  hide_side_toolbar: false,
  studies: ["RSI@tv-basicstudies", "MASimple@tv-basicstudies"],
};

export const COMPANY_FINANCIALS_CONFIG = {
  colorTheme: "dark",
  locale: "de_DE",
  isTransparent: true,
  displayMode: "regular",
  largeChartUrl: "",
};

export const MARKET_QUOTES_CONFIG = {
  colorTheme: "dark",
  locale: "de_DE",
  isTransparent: true,
  showSymbolLogo: true,
  symbolsGroups: [
    {
      name: "SPI",
      originalName: "SPI",
      symbols: [
        { name: "SIX:NESN", displayName: "Nestlé" },
        { name: "SIX:NOVN", displayName: "Novartis" },
        { name: "SIX:ROG", displayName: "Roche" },
        { name: "SIX:UBSG", displayName: "UBS" },
        { name: "SIX:ZURN", displayName: "Zurich" },
        { name: "SIX:ABBN", displayName: "ABB" },
        { name: "SIX:SLHN", displayName: "Swiss Life" },
        { name: "SIX:SREN", displayName: "Swiss Re" },
      ],
    },
    {
      name: "DAX",
      originalName: "DAX",
      symbols: [
        { name: "XETR:SAP", displayName: "SAP" },
        { name: "XETR:SIE", displayName: "Siemens" },
        { name: "XETR:ALV", displayName: "Allianz" },
        { name: "XETR:DTE", displayName: "Telekom" },
        { name: "XETR:MBG", displayName: "Mercedes" },
        { name: "XETR:BMW", displayName: "BMW" },
      ],
    },
  ],
};

export const TICKER_TAPE_CONFIG = {
  colorTheme: "dark",
  locale: "de_DE",
  isTransparent: true,
  showSymbolLogo: true,
  displayMode: "adaptive",
  symbols: [
    { proName: "FOREXCOM:SPXUSD", title: "S&P 500" },
    { proName: "INDEX:SMI", title: "SPI" },
    { proName: "FOREXCOM:NSXUSD", title: "Nasdaq" },
    { proName: "INDEX:DAX", title: "DAX" },
    { proName: "FX:USDCHF", title: "USD/CHF" },
    { proName: "FX:EURCHF", title: "EUR/CHF" },
    { proName: "BITSTAMP:BTCUSD", title: "Bitcoin" },
    { proName: "COMEX:GC1!", title: "Gold" },
  ],
};
