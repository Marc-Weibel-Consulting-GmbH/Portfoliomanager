import { Card } from "@/components/ui/card";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export default function ForgotPassword() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900/50 backdrop-blur">
        <ForgotPasswordForm />
      </Card>
    </div>
  );
}
