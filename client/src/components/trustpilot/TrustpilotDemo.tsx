import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const demoReviews = [
  {
    id: 1,
    author: "Michael Schmidt",
    rating: 5,
    date: "Vor 2 Tagen",
    title: "Hervorragende Portfolio-Analyse",
    text: "Die Portfolio-Optimierung hat mir geholfen, meine Anlagestrategie deutlich zu verbessern. Sehr übersichtlich und professionell!",
  },
  {
    id: 2,
    author: "Sarah Müller",
    rating: 5,
    date: "Vor 1 Woche",
    title: "Perfekt für Schweizer Aktien",
    text: "Endlich eine Plattform, die sich auf den Schweizer Markt konzentriert. Die Dividenden-Analyse ist besonders hilfreich.",
  },
  {
    id: 3,
    author: "Thomas Weber",
    rating: 4,
    date: "Vor 2 Wochen",
    title: "Sehr nützliches Tool",
    text: "Die Newsroom-Funktion hält mich immer auf dem Laufenden. Einziger Wunsch: Mehr internationale Aktien.",
  },
  {
    id: 4,
    author: "Anna Keller",
    rating: 5,
    date: "Vor 3 Wochen",
    title: "Professionelle Analyse",
    text: "Als Finanzberaterin nutze ich dieses Tool täglich. Die Sharpe-Ratio-Optimierung ist erstklassig!",
  },
];

export function TrustpilotDemoHeader() {
  const avgRating = 4.8;
  const totalReviews = 127;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-bold text-2xl">{avgRating}</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= Math.floor(avgRating)
                      ? "fill-green-500 text-green-500"
                      : star === Math.ceil(avgRating)
                      ? "fill-green-500/50 text-green-500"
                      : "text-slate-600"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-slate-400 text-sm">
            Basierend auf {totalReviews} Bewertungen
          </p>
        </div>
        <div className="text-right">
          <div className="text-white font-semibold mb-1">Hervorragend</div>
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="text-slate-400 text-sm">Trustpilot</span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-slate-700">
        <p className="text-amber-400 text-xs">
          ⚠️ DEMO-MODUS: Dies sind Beispiel-Bewertungen. Konfigurieren Sie Ihre Trustpilot Business Unit ID für echte Bewertungen.
        </p>
      </div>
    </div>
  );
}

export function TrustpilotDemoCarousel() {
  return (
    <div className="space-y-4">
      {demoReviews.map((review) => (
        <Card key={review.id} className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-semibold">{review.author}</span>
                  <span className="text-slate-500 text-xs">{review.date}</span>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= review.rating
                          ? "fill-green-500 text-green-500"
                          : "text-slate-600"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
            <h4 className="text-white font-semibold mb-2">{review.title}</h4>
            <p className="text-slate-300 text-sm">{review.text}</p>
          </CardContent>
        </Card>
      ))}
      <div className="text-center pt-2">
        <p className="text-amber-400 text-xs">
          ⚠️ DEMO-MODUS: Beispiel-Bewertungen
        </p>
      </div>
    </div>
  );
}

export function TrustpilotDemoMini() {
  const avgRating = 4.8;
  const totalReviews = 127;

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-white font-semibold">{avgRating}</span>
        <div className="flex">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={`w-4 h-4 ${
                star <= Math.floor(avgRating)
                  ? "fill-green-500 text-green-500"
                  : star === Math.ceil(avgRating)
                  ? "fill-green-500/50 text-green-500"
                  : "text-slate-600"
              }`}
            />
          ))}
        </div>
      </div>
      <span className="text-slate-400 text-sm">
        {totalReviews} Bewertungen
      </span>
      <div className="flex items-center gap-1">
        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
        </svg>
        <span className="text-slate-400 text-xs">Trustpilot</span>
      </div>
      <span className="text-amber-400 text-xs ml-2">DEMO</span>
    </div>
  );
}

