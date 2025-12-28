import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { ArrowLeft, Mail, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    requestReset.mutate({ email });
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl text-white">E-Mail gesendet</CardTitle>
            <CardDescription className="text-slate-400">
              Wir haben Ihnen eine E-Mail mit Anweisungen zum Zurücksetzen Ihres Passworts gesendet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-slate-400 mb-6">
              Bitte überprüfen Sie Ihren Posteingang und folgen Sie dem Link in der E-Mail.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zum Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10">
            <Mail className="h-6 w-6 text-cyan-500" />
          </div>
          <CardTitle className="text-2xl text-white">Passwort vergessen?</CardTitle>
          <CardDescription className="text-slate-400">
            Geben Sie Ihre E-Mail-Adresse ein und wir senden Ihnen einen Link zum Zurücksetzen Ihres Passworts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-slate-200">
                E-Mail-Adresse
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="ihre.email@beispiel.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {requestReset.error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                {requestReset.error.message}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600"
              disabled={requestReset.isPending}
            >
              {requestReset.isPending ? "Wird gesendet..." : "Link senden"}
            </Button>

            <Link href="/login">
              <Button variant="ghost" className="w-full text-slate-400 hover:text-white">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Zurück zum Login
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
