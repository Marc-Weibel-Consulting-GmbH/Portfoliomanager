import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { trpc } from "@/lib/trpc";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const subscribeMutation = trpc.newsletter.subscribe.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setStatus("success");
        setMessage(data.message);
        setEmail("");
      } else {
        setStatus("error");
        setMessage(data.message);
      }
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 5000);
    },
    onError: (error) => {
      setStatus("error");
      setMessage(error.message || "Ein Fehler ist aufgetreten. Bitte versuchen Sie es später erneut.");
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    subscribeMutation.mutate({ email });
  };

  return (
    <div>
      {status === "success" && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-400">
          {message}
        </div>
      )}
      
      {status === "error" && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-400">
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-3">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-slate-700 border-slate-600 text-white"
          placeholder="ihre.email@beispiel.com"
        />
        <Button 
          type="submit" 
          disabled={subscribeMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {subscribeMutation.isPending ? "..." : "Abonnieren"}
        </Button>
      </form>
    </div>
  );
}

