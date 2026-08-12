import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { checkAdminEmail } from "@/lib/admin.functions";
import { ShieldCheck, Mail } from "lucide-react";
import { insforge } from "@/lib/insforge";
import { loginWithGoogle } from "@/lib/insforge-auth";



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
      // Safety timeout: 10 seconds to verify admin email
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Verification timeout")), 10000)
      );

      try {
        const result = await Promise.race([
          checkAdminEmail({ data: user.email }),
          timeoutPromise
        ]) as any;

        if (result.authorized) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
          setError(result.error || "Unauthorized");
        }
      } catch (err) {
        console.error("Admin verification failed:", err);
        setAuthorized(false);
        setError("Security verification failed. Please check your connection and try again.");
      }
    };

    verify();
  }, [user, authLoading, navigate, pathname]);

  if ((authLoading || (user && authorized === null)) && pathname !== "/admin/login") {
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

  if (user && authorized === false && pathname !== "/admin/login") {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 px-6 text-center animate-fade-up">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-zinc-900 shadow-[0_0_50px_rgba(255,255,255,0.05)] ring-1 ring-zinc-800">
          <ShieldCheck className="h-10 w-10 text-white" strokeWidth={1.5} />
        </div>
        
        <div className="mb-6 w-full max-w-[320px] overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 text-left">
          <div className="p-4 border-b border-destructive/10">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">Access Restricted</p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">{error}</p>
          </div>
          
          <div className="bg-zinc-900/50 p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
              <Mail className="h-4 w-4 text-zinc-500" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Current Account</span>
              <span className="text-xs font-medium text-zinc-300 truncate">{user.email}</span>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[320px] space-y-4">
          <button
            onClick={() => {
              loginWithGoogle("admin", { prompt: "select_account" }).catch(err => {
                console.error("Account switch failed:", err);
              });
            }}
            className="h-14 w-full rounded-2xl bg-white text-black shadow-lg hover:bg-zinc-200 font-bold transition-all active:scale-95"
          >
            Sign in with another account
          </button>
          
          <button
            onClick={() => window.location.assign("/admin/login")}
            className="block w-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white transition"
          >
            Return to Admin Login
          </button>
        </div>
      </div>
    );
  }

  if (!user && pathname !== "/admin/login") {
     return <div className="min-h-svh bg-zinc-950" />;
  }

  return <>{children}</>;
}
