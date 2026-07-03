import { useAuth } from "@/_core/hooks/useAuth";
import { Redirect } from "wouter";

// U-11: Client-seitiger Route-Guard für /admin/* — Nicht-Admins landen auf dem
// Dashboard statt auf einer Admin-UI mit fehlschlagenden Queries.
export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user?.role !== "admin") return <Redirect to="/dashboard" />;

  return <>{children}</>;
}
