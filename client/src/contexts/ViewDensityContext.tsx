import React, { createContext, useContext, useEffect, useState } from "react";

// Anzeige-Dichte: unabhängig vom Abo. «einfach» blendet fortgeschrittene
// Kennzahlen (Sharpe, Bubble, Risiko-/KI-Tabs) aus, um dem 50+-Zielpublikum
// mehr Übersicht mit weniger Zahlen zu geben. «detailliert» zeigt alles.
// Neu-Nutzer starten bewusst in «einfach» (Entscheid Produktleitung).
export type ViewDensity = "einfach" | "detailliert";

const STORAGE_KEY = "view-density";
const DEFAULT_DENSITY: ViewDensity = "einfach";

interface ViewDensityContextType {
  density: ViewDensity;
  detailed: boolean;
  setDensity: (d: ViewDensity) => void;
  toggleDensity: () => void;
}

const ViewDensityContext = createContext<ViewDensityContextType | undefined>(undefined);

export function ViewDensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = useState<ViewDensity>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "einfach" || stored === "detailliert" ? stored : DEFAULT_DENSITY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, density);
  }, [density]);

  const setDensity = (d: ViewDensity) => setDensityState(d);
  const toggleDensity = () =>
    setDensityState(prev => (prev === "einfach" ? "detailliert" : "einfach"));

  return (
    <ViewDensityContext.Provider
      value={{ density, detailed: density === "detailliert", setDensity, toggleDensity }}
    >
      {children}
    </ViewDensityContext.Provider>
  );
}

export function useViewDensity() {
  const context = useContext(ViewDensityContext);
  if (!context) {
    throw new Error("useViewDensity must be used within ViewDensityProvider");
  }
  return context;
}
