import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function Login() {
  const utils = trpc.useUtils();
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password) {
      toast.error("Bitte fülle alle Felder aus");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error("Bitte gib eine gültige E-Mail-Adresse ein");
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include", // Important for cookies
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Login fehlgeschlagen");
      }
      
      // Success - redirect immediately with full page reload
      // This ensures the cookie is properly set and read by the browser
      window.location.href = "/dashboard";
    } catch (error: any) {
      setIsLoading(false);
      toast.error("Login fehlgeschlagen: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-white text-center">
            Login
          </CardTitle>
          <p className="text-slate-300 text-center mt-2">
            Melde dich mit deinem Konto an
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-slate-300">
                  Passwort *
                </label>
                <a href="/forgot-password" className="text-xs text-cyan-400 hover:text-cyan-300">
                  Passwort vergessen?
                </a>
              </div>
              <Input
                type="password"
                placeholder="Dein Passwort"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="bg-slate-700 border-slate-600 text-white"
                required
              />
            </div>

            <div className="pt-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold"
              >
                {isLoading ? "Anmelden..." : "Anmelden"}
              </Button>
            </div>

            <div className="text-center text-sm text-slate-400 pt-2">
              Noch nicht registriert?{" "}
              <a href="/register" className="text-blue-400 hover:text-blue-300 font-semibold">
                Jetzt registrieren
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
