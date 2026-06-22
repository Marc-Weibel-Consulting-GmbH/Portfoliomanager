import { trpc } from "@/lib/trpc";
import { Calendar } from "lucide-react";

// Dividenden-Kalender (Mockup S.17): nächste 30 Tage, nur eigene Positionen
// (aggregiert über alle Portfolios via dividendCalendar.upcomingAll).
export default function DividendenTab() {
  const { data: dividends = [], isLoading } = trpc.dividendCalendar.upcomingAll.useQuery({ daysAhead: 30 });

  const totalIncome = dividends.reduce((s: number, d: any) => s + (d.expectedIncome || 0), 0);
  const fmt = (v: number, cur = "CHF") =>
    new Intl.NumberFormat("de-CH", { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(v);

  return (
    <div className="bg-[#0f1420] border border-white/10 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Dividenden-Kalender</h3>
          <p className="text-xs text-gray-500">Nächste 30 Tage · eigene Positionen</p>
        </div>
        {dividends.length > 0 && (
          <div className="text-right">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Erwartet</p>
            <p className="text-lg font-bold font-mono text-[#00CFC1]">{fmt(totalIncome)}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[#00CFC1] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : dividends.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="h-10 w-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Keine anstehenden Dividenden in den nächsten 30 Tagen.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ex-Datum</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Titel</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Betrag/Aktie</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Stk.</th>
                <th className="text-right px-5 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Erwartet (CHF)</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d: any, i: number) => (
                <tr key={`${d.ticker}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {d.exDividendDate ? new Date(d.exDividendDate).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }) : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-[#00CFC1] mr-2">{d.ticker}</span>
                    <span className="text-sm text-white">{d.companyName}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-300">{fmt(d.amount, d.currency)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-300">{d.shares}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-[#00CFC1]">{fmt(d.expectedIncome)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
