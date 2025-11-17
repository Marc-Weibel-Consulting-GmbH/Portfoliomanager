import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { useMemo } from 'react';

export function PortfolioSentimentIndicator() {
  const { data: stocks, isLoading } = trpc.stocks.list.useQuery();

  const sentimentData = useMemo(() => {
    if (!stocks || stocks.length === 0) {
      return { score: 50, label: 'Neutral', color: '#94a3b8', description: 'Keine Daten verfügbar' };
    }

    // Calculate sentiment based on portfolio metrics
    let score = 50; // Start neutral

    // 1. YTD Performance (weight: 30%)
    const avgYTD = stocks.reduce((sum, s) => sum + (parseFloat(s.ytdPerformance?.toString() || '0')), 0) / stocks.length;
    if (avgYTD > 20) score += 15;
    else if (avgYTD > 10) score += 10;
    else if (avgYTD > 0) score += 5;
    else if (avgYTD < -10) score -= 15;
    else if (avgYTD < 0) score -= 10;

    // 2. Sharpe Ratio (weight: 25%)
    const avgSharpe = stocks.reduce((sum, s) => sum + (parseFloat(s.sharpeRatio?.toString() || '0')), 0) / stocks.length;
    if (avgSharpe > 1.5) score += 12;
    else if (avgSharpe > 1.0) score += 8;
    else if (avgSharpe > 0.5) score += 4;
    else if (avgSharpe < 0) score -= 12;

    // 3. P/E Ratio (weight: 20%)
    const validPE = stocks.filter(s => s.peRatio && parseFloat(s.peRatio.toString()) > 0);
    if (validPE.length > 0) {
      const avgPE = validPE.reduce((sum, s) => sum + parseFloat(s.peRatio!.toString()), 0) / validPE.length;
      if (avgPE < 15) score += 8; // Undervalued
      else if (avgPE < 25) score += 4; // Fair value
      else if (avgPE > 40) score -= 8; // Overvalued
    }

    // 4. Dividend Yield (weight: 15%)
    const avgDiv = stocks.reduce((sum, s) => sum + (parseFloat(s.dividendYield?.toString() || '0')), 0) / stocks.length;
    if (avgDiv > 3) score += 6;
    else if (avgDiv > 2) score += 3;

    // 5. Volatility (weight: 10%) - lower is better
    const avgVol = stocks.reduce((sum, s) => sum + (parseFloat(s.volatility?.toString() || '0')), 0) / stocks.length;
    if (avgVol < 20) score += 4;
    else if (avgVol > 40) score -= 4;

    // Clamp score between 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine label and color
    let label = '';
    let color = '';
    let description = '';

    if (score >= 75) {
      label = 'Extreme Greed';
      color = '#22c55e'; // green
      description = 'Portfolio zeigt starke Überbewertung. Gewinnmitnahmen erwägen.';
    } else if (score >= 60) {
      label = 'Greed';
      color = '#84cc16'; // lime
      description = 'Portfolio entwickelt sich gut. Vorsichtige Optimierung möglich.';
    } else if (score >= 45) {
      label = 'Neutral';
      color = '#94a3b8'; // slate
      description = 'Portfolio in ausgewogener Position. Strategie beibehalten.';
    } else if (score >= 30) {
      label = 'Fear';
      color = '#fb923c'; // orange
      description = 'Portfolio unter Druck. Qualitätsaktien nachkaufen erwägen.';
    } else {
      label = 'Extreme Fear';
      color = '#ef4444'; // red
      description = 'Portfolio stark unterbewertet. Kaufgelegenheiten prüfen.';
    }

    return { score: Math.round(score), label, color, description };
  }, [stocks]);

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Portfolio Sentiment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-48">
            <div className="text-slate-400">Lade Sentiment-Daten...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { score, label, color, description } = sentimentData;

  // Calculate needle rotation (0-180 degrees)
  const rotation = (score / 100) * 180;

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <CardTitle className="text-white">Portfolio Sentiment</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-slate-900/50 rounded-lg p-6">
          {/* Gauge Chart */}
          <div className="relative w-full h-48 flex items-end justify-center">
            {/* Background Arc */}
            <svg className="w-full h-full" viewBox="0 0 200 100">
              {/* Red zone (0-25) */}
              <path
                d="M 10 90 A 90 90 0 0 1 55 15"
                fill="none"
                stroke="#ef4444"
                strokeWidth="20"
                opacity="0.3"
              />
              {/* Orange zone (25-45) */}
              <path
                d="M 55 15 A 90 90 0 0 1 100 5"
                fill="none"
                stroke="#fb923c"
                strokeWidth="20"
                opacity="0.3"
              />
              {/* Gray zone (45-60) */}
              <path
                d="M 100 5 A 90 90 0 0 1 145 15"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="20"
                opacity="0.3"
              />
              {/* Lime zone (60-75) */}
              <path
                d="M 145 15 A 90 90 0 0 1 175 50"
                fill="none"
                stroke="#84cc16"
                strokeWidth="20"
                opacity="0.3"
              />
              {/* Green zone (75-100) */}
              <path
                d="M 175 50 A 90 90 0 0 1 190 90"
                fill="none"
                stroke="#22c55e"
                strokeWidth="20"
                opacity="0.3"
              />
              
              {/* Needle */}
              <g transform={`rotate(${rotation - 90} 100 90)`}>
                <line
                  x1="100"
                  y1="90"
                  x2="100"
                  y2="20"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="100" cy="90" r="6" fill={color} />
              </g>
            </svg>
          </div>

          {/* Score Display */}
          <div className="text-center mt-4">
            <div className="text-4xl font-bold" style={{ color }}>
              {score}
            </div>
            <div className="text-lg font-semibold mt-1" style={{ color }}>
              {label}
            </div>
            <p className="text-slate-400 text-sm mt-3 max-w-xs mx-auto">
              {description}
            </p>
          </div>

          {/* Legend */}
          <div className="mt-6 grid grid-cols-5 gap-2 text-xs text-center">
            <div>
              <div className="w-full h-2 bg-red-500 rounded mb-1 opacity-30"></div>
              <div className="text-slate-500">Extreme Fear</div>
            </div>
            <div>
              <div className="w-full h-2 bg-orange-400 rounded mb-1 opacity-30"></div>
              <div className="text-slate-500">Fear</div>
            </div>
            <div>
              <div className="w-full h-2 bg-slate-400 rounded mb-1 opacity-30"></div>
              <div className="text-slate-500">Neutral</div>
            </div>
            <div>
              <div className="w-full h-2 bg-lime-500 rounded mb-1 opacity-30"></div>
              <div className="text-slate-500">Greed</div>
            </div>
            <div>
              <div className="w-full h-2 bg-green-500 rounded mb-1 opacity-30"></div>
              <div className="text-slate-500">Extreme Greed</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

