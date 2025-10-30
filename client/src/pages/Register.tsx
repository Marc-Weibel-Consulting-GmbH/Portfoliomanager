import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Register() {
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    mobile: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      toast.error("Bitte fülle alle Pflichtfelder aus");
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error("Passwort muss mindestens 6 Zeichen lang sein");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include", // Important for cookies
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Registrierung fehlgeschlagen");
      }
      
      // Success - show toast and redirect
      toast.success("Erfolgreich registriert! Willkommen bei Portfolio BIG.");
      
      // Invalidate auth query to force refetch with new cookie
      await utils.auth.me.invalidate();
      
      // Wait 2 seconds to ensure cookie is saved on mobile, then force reload
      setTimeout(() => {
        window.location.replace("/");
      }, 2000);
    } catch (error: any) {
      setIsLoading(false);
      toast.error("Registrierung fehlgeschlagen: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-white text-center">
            Registrierung
          </CardTitle>
          <p className="text-slate-300 text-center mt-2">
            Erstelle ein kostenloses Konto für Zugriff auf das Portfolio
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Vorname *
              </label>
              <Input
                type="text"
                placeholder="Max"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Nachname *
              </label>
              <Input
                type="text"
                placeholder="Mustermann"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                E-Mail *
              </label>
              <Input
                type="email"
                placeholder="max@beispiel.ch"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Passwort *
              </label>
              <Input
                type="password"
                placeholder="Mindestens 6 Zeichen"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
                minLength={6}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Mobile (optional)
              </label>
              <Input
                type="tel"
                placeholder="+41 79 123 45 67"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
              >
                {isLoading ? "Registriere..." : "Kostenlos registrieren"}
              </Button>
            </div>

            <div className="text-center text-sm text-slate-400 pt-2">
              Nach der Registrierung erhältst du Zugriff auf 1 Aktie pro Kategorie (13 von 63).
              <br />
              Für vollen Zugriff: <span className="text-blue-400 font-semibold">CHF 10.- einmalig</span>
            </div>
            
            <div className="text-center text-sm text-slate-400 pt-2 border-t border-slate-700 mt-4 pt-4">
              Bereits registriert?{" "}
              <a href="/login" className="text-blue-400 hover:text-blue-300 font-semibold">
                Jetzt anmelden
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

