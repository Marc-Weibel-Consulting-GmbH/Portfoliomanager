import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import RegisterForm from "@/components/auth/RegisterForm";

export default function Register() {
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
          <RegisterForm />
        </CardContent>
      </Card>
    </div>
  );
}
