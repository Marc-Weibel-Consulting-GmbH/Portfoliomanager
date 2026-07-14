import { trpc } from "@/lib/trpc";
import { Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";

// Dividenden-Kalender (Mockup S.17): nächste 12 Monate, nur eigene Positionen
// (aggregiert über alle Portfolios via dividendCalendar.upcomingAll).
export default function DividendenTab() {
  const { data: dividends = [], isLoading } = trpc.dividendCalendar.upcomingAll.useQuery({ daysAhead: 365 });

  const totalIncome = dividends.reduce((s: number, d: any) => s + (d.expectedIncome || 0), 0);

  return (
    <div className="bg-[#0f1420] border border-white/10 rounded-lg">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h3 className="text-sm font-semibold text-white">Dividenden-Kalender</h3>
          <p className="text-xs text-gray-400">Nächste 12 Monate · eigene Positionen</p>
        </div>
        {dividends.length > 0 && (
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Erwartet brutto (12M)</p>
            <p className="text-lg font-bold font-mono text-[#00CFC1]">{formatCurrency(totalIncome)}</p>
            {/* FIN-5: Brutto-Kennzeichnung — vorher wirkte der Betrag wie Netto-Einkommen */}
            <p className="text-xs text-gray-500">vor Verrechnungs-/Quellensteuer</p>
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
          <p className="text-gray-400 text-sm">Keine anstehenden Dividenden in den nächsten 12 Monaten.</p>
          <p className="text-gray-400 text-xs mt-1">Stellen Sie sicher, dass Ihre Portfolios Positionen mit Dividenden enthalten.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ex-Datum</th>
                <th className="text-left px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Titel</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Typ</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Betrag/Aktie</th>
                <th className="text-right px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Stk.</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Erwartet brutto (CHF)</th>
              </tr>
            </thead>
            <tbody>
              {dividends.map((d: any, i: number) => (
                <tr key={`${d.ticker}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-5 py-3 text-sm text-gray-400">
                    {d.exDividendDate ? formatDate(d.exDividendDate) : "—"}
                    {d.type === "estimated" && (
                      <span className="ml-1 text-xs text-yellow-500/70" title="geschätzter Termin">~</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-xs text-[#00CFC1] mr-2">{d.ticker}</span>
                    <span className="text-sm text-white">{d.companyName}</span>
                  </td>
                  <td className="px-3 py-3 text-right hidden sm:table-cell">
                    <span className="text-xs text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">{d.period || "—"}</span>
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-300">{formatCurrency(d.amount, d.currency)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-300 hidden sm:table-cell">{d.shares}</td>
                  <td className="px-5 py-3 text-right text-sm font-semibold text-[#00CFC1]">
                    {d.fxMissing ? (
                      <span className="text-gray-500" title={`Kein ${d.currency}/CHF-Wechselkurs verfügbar`}>—</span>
                    ) : (
                      formatCurrency(d.expectedIncome)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
