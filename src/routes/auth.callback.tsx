import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { setAccessToken } from "@/lib/insforge-auth";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  validateSearch: (search: Record<string, unknown>) => ({
    token: search.token as string | undefined,
    portal: search.portal as string | undefined,
  }),
});

function AuthCallback() {
  const { token, portal } = useSearch({ from: "/auth/callback" });
  const navigate = useNavigate();

  useEffect(() => {
    if (token) {
      setAccessToken(token);
      
      // Navigate to the intended portal
      const dest = portal === "customer" || !portal ? "/app" : `/${portal}`;
      
      // Small delay to ensure AuthProvider picks up the token change
      setTimeout(() => {
        window.location.assign(dest);
      }, 100);
    } else {
      // Failed login
      navigate({ to: "/" as any });
    }
  }, [token, portal, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center p-6 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
      <h2 className="font-display text-xl font-bold">Finishing login...</h2>
      <p className="text-sm text-muted-foreground mt-2">Almost there! We're setting up your session.</p>
    </div>
  );
}
