import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { NewsletterForm } from "@/components/NewsletterForm";
import { PaymentButton } from "@/components/PaymentButton";
import { WhatsAppAlertsSettings } from "@/components/WhatsAppAlertsSettings";

interface AboutProps {
  onBackClick: () => void;
}

export default function About({ onBackClick }: AboutProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const contactMutation = trpc.contact.send.useMutation({
    onSuccess: () => {
      setSubmitStatus("success");
      setFormData({ name: "", email: "", message: "" });
      setTimeout(() => setSubmitStatus("idle"), 5000);
    },
    onError: () => {
      setSubmitStatus("error");
      setTimeout(() => setSubmitStatus("idle"), 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    contactMutation.mutate(formData);
  };

  const handleWhatsApp = () => {
    const phoneNumber = import.meta.env.VITE_WHATSAPP_NUMBER || "41791234567";
    const message = encodeURIComponent("Hallo, ich möchte mehr über Ihre Portfolio-Analyse erfahren.");
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, "_blank");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4">
      {/* Header with Back Button */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Über mich</h2>
        <Button onClick={onBackClick} variant="outline" className="bg-slate-700 border-slate-600 text-white hover:bg-slate-600">
          ← Zurück
        </Button>
      </div>

      {/* About Me Section */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b border-slate-700">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-white flex items-center justify-center p-2">
              <img 
                src={import.meta.env.VITE_APP_LOGO || '/logo.png'}
                alt="Marc Weibel"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to initials if logo fails to load
                  if (e.currentTarget.parentElement) {
                    e.currentTarget.parentElement.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-4xl font-bold">MW</div>';
                  }
                }}
              />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Marc Weibel</h3>
              <p className="text-slate-400">Portfolio Manager & Investment Analyst</p>
            </div>
          </div>

          <div className="space-y-4 text-slate-300">
            <p>
              Willkommen auf meiner Portfolio-Analyse-Plattform! Ich bin ein erfahrener Investment-Analyst mit über 15 Jahren Erfahrung in der Finanzbranche.
            </p>
            <p>
              Meine Expertise liegt in der fundamentalen Aktienanalyse, Portfolio-Optimierung und der Identifikation von Unternehmen mit nachhaltigen Wettbewerbsvorteilen (Economic Moats).
            </p>

            <div className="pt-4">
              <h4 className="text-lg font-semibold text-white mb-3">Meine Expertise</h4>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Fundamentale Aktienanalyse und Bewertung</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Portfolio-Konstruktion und Risikomanagement</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Identifikation von Qualitätsunternehmen mit Wettbewerbsvorteilen</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Langfristige Investmentstrategien (Buy & Hold)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-400 mt-1">✓</span>
                  <span>Dividendenstrategien und Einkommensgenerierung</span>
                </li>
              </ul>
            </div>

            <div className="pt-4">
              <h4 className="text-lg font-semibold text-white mb-3">Philosophie</h4>
              <p>
                Ich folge einer langfristigen, wertorientierten Investmentphilosophie, inspiriert von Warren Buffett und Charlie Munger. 
                Mein Fokus liegt auf Qualitätsunternehmen mit starken Wettbewerbsvorteilen, soliden Finanzen und nachhaltigem Wachstumspotenzial.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Section */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">🔓 Vollzugriff freischalten</h3>
        <p className="text-slate-300 mb-4">
          Erhalten Sie Zugriff auf alle {import.meta.env.VITE_APP_TITLE || 'Portfolio'} Aktien und Analysen für eine einmalige Gebühr von <strong className="text-white">CHF 10.-</strong>
        </p>
        <PaymentButton />
      </Card>

      {/* Newsletter Section */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">📬 Newsletter abonnieren</h3>
        <p className="text-slate-300 mb-4">
          Erhalten Sie regelmäßig Updates zu meinem Portfolio, Marktanalysen und Investment-Insights direkt in Ihr Postfach.
        </p>
        <NewsletterForm />
      </Card>

      {/* WhatsApp Alerts Settings */}
      <WhatsAppAlertsSettings />

      {/* Contact Section */}
      <Card className="bg-slate-800 border-slate-700 p-6">
        <h3 className="text-xl font-bold text-white mb-4">Kontakt</h3>
        
        {submitStatus === "success" && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-400">
            Vielen Dank für Ihre Nachricht! Ich werde mich bald bei Ihnen melden.
          </div>
        )}
        
        {submitStatus === "error" && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400">
            Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Name</label>
            <Input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="Ihr Name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Email</label>
            <Input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white"
              placeholder="ihre.email@beispiel.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Nachricht</label>
            <Textarea
              required
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="bg-slate-700 border-slate-600 text-white min-h-[120px]"
              placeholder="Ihre Nachricht..."
            />
          </div>

          <div className="flex gap-3">
            <Button 
              type="submit" 
              disabled={contactMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {contactMutation.isPending ? "Senden..." : "📧 Per Email senden"}
            </Button>
            <Button 
              type="button"
              onClick={handleWhatsApp}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              💬 Per WhatsApp kontaktieren
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

