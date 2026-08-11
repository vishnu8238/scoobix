import { createFileRoute } from "@tanstack/react-router";
import { Truck, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/logistics/login")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Login" }] }),
  component: LogisticsLogin,
});

function LogisticsLogin() {
  const { login, user, loading } = useAuth();
  const [isUnauthorized, setIsUnauthorized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "unauthorized") {
      setIsUnauthorized(true);
    }
  }, []);

  const hasLogisticsRole = user?.roles?.includes("logistics");

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent shadow-[0_0_15px_rgba(14,165,233,0.3)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up bg-slate-950 text-white font-sans">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-slate-900 shadow-[0_0_50px_rgba(14,165,233,0.1)] ring-1 ring-slate-800">
        <Truck className="h-10 w-10 text-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.4)]" strokeWidth={1.5} />
      </div>
      
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-black tracking-tight text-white uppercase italic">Scoobix</h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-sky-500/70">Logistics Operations</p>
      </div>

      <p className="mt-4 max-w-[280px] text-sm font-medium text-slate-400">
        Operational Control Center
      </p>

      {isUnauthorized && (
        <div className="mt-8 w-full max-w-[320px] overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 text-left">
          <div className="p-4 border-b border-destructive/10">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">Access Restricted</p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">
              This account is not authorized for Logistics Operations.
            </p>
          </div>
          
          {user && (
            <div className="bg-slate-900/50 p-4 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center">
                <Mail className="h-4 w-4 text-slate-500" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Current Account</span>
                <span className="text-xs font-medium text-slate-300 truncate">{user.email}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 w-full space-y-4 max-w-[320px]">
        {hasLogisticsRole ? (
          <Button 
            onClick={() => window.location.assign("/logistics")}
            className="h-14 w-full rounded-2xl bg-sky-600 text-white shadow-[0_0_20px_rgba(14,165,233,0.3)] hover:bg-sky-500 font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Enter Logistics Portal
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <>
            <Button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                login('google', 'logistics', { prompt: 'select_account' });
              }}
              className="h-14 w-full rounded-2xl bg-white text-black shadow-lg hover:bg-slate-200 font-bold transition-all active:scale-95"
            >
              <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
              {user ? "Sign in with another account" : "Continue with Google"}
            </Button>

            {isUnauthorized && (
               <button
                 onClick={() => {
                   window.location.search = "";
                 }}
                 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition py-2"
               >
                 Return to Login
               </button>
            )}
          </>
        )}
      </div>

      <div className="mt-12 flex flex-col gap-2">
        <p className="text-[9px] text-slate-600 uppercase tracking-[0.3em] font-black">
          Operational Staff Only
        </p>
        <div className="h-px w-12 bg-slate-900 mx-auto" />
      </div>
    </div>
  );
}
