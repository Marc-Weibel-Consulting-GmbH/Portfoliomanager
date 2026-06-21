import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import LoginForm from "@/components/auth/LoginForm";
import RegisterForm from "@/components/auth/RegisterForm";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

type AuthTab = "login" | "register" | "forgot";

const VALID_TABS: AuthTab[] = ["login", "register", "forgot"];

function parseTab(search: string): AuthTab {
  const params = new URLSearchParams(search);
  const tab = params.get("tab");
  if (tab && (VALID_TABS as string[]).includes(tab)) {
    return tab as AuthTab;
  }
  return "login";
}

export default function Auth() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const activeTab = parseTab(search);

  const handleTabChange = (value: string) => {
    setLocation(`/auth?tab=${value}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-slate-800/90 border-slate-700">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <div className="px-6 pt-6">
            <TabsList className="grid w-full grid-cols-3 bg-slate-700/50">
              <TabsTrigger
                value="login"
                className="data-[state=active]:bg-[#00CFC1] data-[state=active]:text-slate-900 text-slate-300"
              >
                Login
              </TabsTrigger>
              <TabsTrigger
                value="register"
                className="data-[state=active]:bg-[#00CFC1] data-[state=active]:text-slate-900 text-slate-300"
              >
                Registrieren
              </TabsTrigger>
              <TabsTrigger
                value="forgot"
                className="data-[state=active]:bg-[#00CFC1] data-[state=active]:text-slate-900 text-slate-300"
              >
                Passwort vergessen
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="login">
            <CardHeader>
              <CardTitle className="text-3xl font-bold text-white text-center">
                Login
              </CardTitle>
              <p className="text-slate-300 text-center mt-2">
                Melde dich mit deinem Konto an
              </p>
            </CardHeader>
            <CardContent>
              <LoginForm />
            </CardContent>
          </TabsContent>

          <TabsContent value="register">
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
          </TabsContent>

          <TabsContent value="forgot">
            <ForgotPasswordForm />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
