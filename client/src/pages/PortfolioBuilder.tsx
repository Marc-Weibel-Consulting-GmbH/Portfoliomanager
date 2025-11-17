import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLocation } from "wouter";

export default function PortfolioBuilder() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Portfolio Builder</h1>
            <p className="text-muted-foreground mt-1">
              Erstellen und verwalten Sie Ihre Portfolios
            </p>
          </div>
          <Button onClick={() => setLocation("/optimizer")}>
            <Plus className="mr-2 h-4 w-4" />
            Neues Portfolio
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio Builder</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nutzen Sie den Portfolio Optimizer, um neue Portfolios zu erstellen und zu optimieren.
            </p>
            <Button 
              onClick={() => setLocation("/optimizer")} 
              className="mt-4"
            >
              Zum Portfolio Optimizer
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
