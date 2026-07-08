/**
 * AktienTabsNav — Tab-Navigation der Aktien-Sektion (F-14).
 * «Titel» = /aktien (Suche & Universum), «Kaufsignale» = /aktien/signale
 * (Titel mit Kaufempfehlung aus der Empfehlungsliste + Empfehlungs-Historie).
 */
import { Link } from "wouter";

export default function AktienTabsNav({ active }: { active: "titel" | "signale" }) {
  const tabs = [
    { key: "titel" as const, label: "Titel", href: "/aktien" },
    { key: "signale" as const, label: "Kaufsignale", href: "/aktien/signale" },
  ];
  return (
    <div className="flex items-center gap-0 border-b border-white/10">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href}>
          <span
            className={`inline-block px-4 pb-3 pt-2 text-sm cursor-pointer border-b-2 transition-colors ${
              active === tab.key
                ? "border-[#00CFC1] text-[#00CFC1]"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
