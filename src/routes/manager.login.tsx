import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/manager/login")({
  head: () => ({ meta: [{ title: "Scoobix Manager · Login" }] }),
  component: ManagerLogin,
});

function ManagerLogin() {
  const { login, user, loading } = useAuth();
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [denialType, setDenialType] = useState<"denied" | "disabled" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("disabled") === "manager") {
      setDenialType("disabled");
      setIsUnauthorized(true);
    } else if (params.get("denied") === "manager") {
      setDenialType("denied");
      setIsUnauthorized(true);
    }
  }, []);

  const hasManagerRole = user?.roles?.includes("manager");

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0f766e] shadow-glow">
        <LogIn className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Manager Portal</h1>
      <p className="mt-2 text-muted-foreground max-w-[280px]">Sign in to manage your merchant operations</p>

      {isUnauthorized && (
        <div className="mt-8 w-full max-w-[320px] overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 text-left">
          <div className="p-4">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">
              {denialType === "disabled" ? "Access Disabled" : "Access Restricted"}
            </p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">
              {denialType === "disabled" 
                ? "Your Scoobix Manager access has been disabled." 
                : "This Google account is not authorized for Scoobix Manager."}
            </p>
            {user && <p className="mt-2 text-[11px] text-destructive/70 truncate">Account: {user.email}</p>}
          </div>
        </div>
      )}

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
        {hasManagerRole ? (
          <Button 
            onClick={() => window.location.assign("/manager")}
            className="h-14 w-full rounded-2xl bg-[#0f766e] text-white shadow-soft hover:bg-[#0d635c] font-bold"
          >
            Enter Manager Portal
          </Button>
        ) : (
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              login('google', 'manager');
            }}
            className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
          >
            <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
            Continue with Google
          </Button>
        )}
      </div>
    </div>
  );
}
