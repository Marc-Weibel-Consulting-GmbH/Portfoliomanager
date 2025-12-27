import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");
    if (tokenParam) {
      setToken(tokenParam);
    } else {
      setStatus("error");
    }
  }, []);

  const verifyEmail = trpc.auth.verifyEmail.useMutation({
    onSuccess: () => {
      setStatus("success");
      setTimeout(() => {
        setLocation("/dashboard");
      }, 3000);
    },
    onError: () => {
      setStatus("error");
    },
  });

  useEffect(() => {
    if (token && status === "loading") {
      verifyEmail.mutate({ token });
    }
  }, [token, status]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/10">
              <Loader2 className="h-6 w-6 text-cyan-500 animate-spin" />
            </div>
            <CardTitle className="text-2xl text-white">E-Mail wird verifiziert</CardTitle>
            <CardDescription className="text-slate-400">
              Bitte warten Sie einen Moment...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <CardTitle className="text-2xl text-white">E-Mail verifiziert</CardTitle>
            <CardDescription className="text-slate-400">
              Ihre E-Mail-Adresse wurde erfolgreich verifiziert. Sie werden in Kürze zum Dashboard weitergeleitet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard">
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600">
                Zum Dashboard
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
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <CardTitle className="text-2xl text-white">Verifizierung fehlgeschlagen</CardTitle>
          <CardDescription className="text-slate-400">
            Der Verifizierungslink ist ungültig oder abgelaufen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-400 text-center">
            Bitte melden Sie sich an und fordern Sie einen neuen Verifizierungslink an.
          </p>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Zum Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
