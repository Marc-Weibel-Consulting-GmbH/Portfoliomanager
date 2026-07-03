import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function RegisterForm() {
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

    if (formData.password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
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

      // Wait 2 seconds to ensure cookie is saved on mobile, then redirect to dashboard
      setTimeout(() => {
        window.location.replace("/dashboard");
      }, 2000);
    } catch (error: any) {
      setIsLoading(false);
      toast.error("Registrierung fehlgeschlagen: " + error.message);
    }
  };

  return (
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
          placeholder="Mindestens 8 Zeichen"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="bg-slate-700 border-slate-600 text-white"
          required
          minLength={8}
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


      <div className="text-center text-sm text-slate-400 pt-2 border-t border-slate-700 mt-4 pt-4">
        Bereits registriert?{" "}
        <a href="/login" className="text-blue-400 hover:text-blue-300 font-semibold">
          Jetzt anmelden
        </a>
      </div>
    </form>
  );
}
