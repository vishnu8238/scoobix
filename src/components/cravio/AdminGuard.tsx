import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { checkAdminEmail } from "@/lib/admin.functions";

interface AdminGuardProps {
  children: ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      if (pathname !== "/admin/login") {
        navigate({ to: "/admin/login" as any });
      }
      return;
    }

    const verify = async () => {
      try {
        const result = await checkAdminEmail({ data: user.email });
        if (result.authorized) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          setError(result.error || "Unauthorized");
        }
      } catch (err) {
        console.error("Admin verification failed:", err);
        setAuthorized(false);
        setError("Security verification failed. Please try again.");
      }
    };

    verify();
  }, [user, authLoading, navigate, pathname]);

  if (authLoading || (user && authorized === null)) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 animate-pulse">
            Security Verification...
          </p>
        </div>
      </div>
    );
  }

  if (user && authorized === false) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 px-6 text-center">
        <div className="mb-6 rounded-2xl bg-destructive/10 p-4 ring-1 ring-destructive/20">
          <p className="text-sm font-bold text-destructive">{error}</p>
        </div>
        <button
          onClick={() => window.location.assign("/admin/login")}
          className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition"
        >
          Return to Login
        </button>
      </div>
    );
  }

  if (!user && pathname !== "/admin/login") {
     return <div className="min-h-svh bg-zinc-950" />;
  }

  return <>{children}</>;
}
