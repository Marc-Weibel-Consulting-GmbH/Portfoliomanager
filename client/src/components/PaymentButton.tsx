import { useState } from "react";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { CreditCard, CheckCircle2 } from "lucide-react";

export function PaymentButton() {
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const createCheckoutMutation = trpc.payment.createCheckout.useMutation({
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        setMessage(data.message || "Fehler beim Erstellen der Zahlungssitzung.");
        setProcessing(false);
      }
    },
    onError: (error) => {
      setMessage(`Fehler: ${error.message}`);
      setProcessing(false);
      setTimeout(() => setMessage(""), 5000);
    },
  });

  const handlePayment = () => {
    if (!user) {
      setMessage("Bitte melden Sie sich zuerst an.");
      setTimeout(() => setMessage(""), 5000);
      return;
    }

    setProcessing(true);
    setMessage("");
    createCheckoutMutation.mutate();
  };

  // Check if user has already paid
  const hasPaid = user?.hasPaid === 1;

  if (hasPaid) {
    return (
      <div className="p-4 bg-green-900/30 border border-green-700 rounded-lg flex items-center gap-3">
        <CheckCircle2 className="w-6 h-6 text-green-500" />
        <div>
          <p className="text-green-400 font-semibold">Vollzugriff aktiv</p>
          <p className="text-green-300 text-sm">Sie haben bereits Zugriff auf alle Aktien.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div className="mb-3 p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-400 text-sm">
          {message}
        </div>
      )}
      
      {!user ? (
        <div className="p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
          <p className="text-blue-300 text-sm mb-3">
            Bitte melden Sie sich an, um den Vollzugriff freizuschalten.
          </p>
          <Button
            disabled
            className="w-full bg-slate-600 cursor-not-allowed"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Anmeldung erforderlich
          </Button>
        </div>
      ) : (
        <Button
          onClick={handlePayment}
          disabled={processing}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold text-lg py-6"
        >
          <CreditCard className="w-5 h-5 mr-2" />
          {processing ? "Wird geladen..." : "Jetzt für CHF 10.- freischalten"}
        </Button>
      )}
      
      <p className="text-slate-400 text-xs mt-3 text-center">
        Sichere Zahlung via Stripe • Einmalige Gebühr • Sofortiger Zugriff
      </p>
    </div>
  );
}

