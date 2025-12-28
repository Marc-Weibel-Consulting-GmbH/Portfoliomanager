import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireOnboarding?: boolean;
}

export default function ProtectedRoute({ children, requireOnboarding = true }: ProtectedRouteProps) {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (loading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      setLocation("/login");
      return;
    }

    // If onboarding is required and user hasn't completed it, redirect to onboarding
    if (requireOnboarding && user && !user.hasCompletedOnboarding) {
      setLocation("/onboarding");
      return;
    }
  }, [loading, isAuthenticated, user, requireOnboarding, setLocation]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  // If not authenticated, show nothing (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // If onboarding required but not completed, show nothing (will redirect)
  if (requireOnboarding && user && !user.hasCompletedOnboarding) {
    return null;
  }

  // Render children if all checks pass
  return <>{children}</>;
}
