import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { z } from "zod";

export const Route = createFileRoute("/admin/login")({
  validateSearch: (search) => z.object({
    error: z.string().optional()
  }).parse(search),
  head: () => ({ meta: [{ title: "Scoobix Admin · Login" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const { login } = useAuth();
  const search = Route.useSearch();
  const isUnauthorized = search.error === "unauthorized";
  console.log("AdminLogin render, isUnauthorized:", isUnauthorized, "search:", search);


  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up bg-zinc-950 text-white font-sans">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[2.5rem] bg-zinc-900 shadow-[0_0_50px_rgba(255,255,255,0.05)] ring-1 ring-zinc-800">
        <ShieldCheck className="h-10 w-10 text-white" strokeWidth={1.5} />
      </div>
      
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-4xl font-black tracking-tight text-white uppercase italic">Scoobix</h1>
        <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-zinc-500">Master Admin</p>
      </div>

      <p className="mt-4 max-w-[280px] text-sm font-medium text-zinc-400">
        Platform Control Center
      </p>

      {isUnauthorized && (
        <div className="mt-8 w-full max-w-[320px] rounded-2xl bg-destructive/10 p-4 ring-1 ring-destructive/20">
          <p className="text-xs font-bold text-destructive">
            This Google account is not authorized for Scoobix Admin.
          </p>
        </div>
      )}

      <div className="mt-8 w-full space-y-4 max-w-[320px]">
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            login('google', 'admin');
          }}
          className="h-14 w-full rounded-2xl bg-white text-black shadow-lg hover:bg-zinc-200 font-bold transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
          Continue with Google
        </Button>
      </div>

      <div className="mt-12 flex flex-col gap-2">
        <p className="text-[9px] text-zinc-600 uppercase tracking-[0.3em] font-black">
          Authorized Personnel Only
        </p>
        <div className="h-px w-12 bg-zinc-900 mx-auto" />
      </div>
    </div>
  );
}
