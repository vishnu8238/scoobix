import { createFileRoute } from "@tanstack/react-router";
import { Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/rider/login")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Login" }] }),
  component: RiderLogin,
});

function RiderLogin() {
  const { login, user, loading } = useAuth();
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [denialType, setDenialType] = useState<"denied" | "disabled" | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("disabled") === "rider") {
      setDenialType("disabled");
      setIsUnauthorized(true);
    } else if (params.get("denied") === "rider") {
      setDenialType("denied");
      setIsUnauthorized(true);
    }
  }, []);

  const hasRiderRole = user?.roles?.includes("rider");

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up bg-zinc-50">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-glow">
        <Bike className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Rider App</h1>
      <p className="mt-2 text-muted-foreground">Earn on your schedule. Deliver with Scoobix.</p>

      {isUnauthorized && (
        <div className="mt-8 w-full max-w-[320px] overflow-hidden rounded-2xl bg-destructive/10 ring-1 ring-destructive/20 text-left">
          <div className="p-4">
            <p className="text-xs font-bold text-destructive uppercase tracking-wider">
              {denialType === "disabled" ? "Access Disabled" : "Access Restricted"}
            </p>
            <p className="mt-1 text-[13px] font-medium text-destructive/90">
              {denialType === "disabled" 
                ? "Your Scoobix Rider access has been disabled." 
                : "This Google account is not authorized for Scoobix Rider."}
            </p>
            {user && <p className="mt-2 text-[11px] text-destructive/70 truncate">Account: {user.email}</p>}
          </div>
        </div>
      )}

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
        {hasRiderRole ? (
          <Button 
            onClick={() => window.location.assign("/rider")}
            className="h-14 w-full rounded-2xl bg-emerald-600 text-white shadow-soft hover:bg-emerald-500 font-bold"
          >
            Enter Rider Portal
          </Button>
        ) : (
          <Button 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              login('google', 'rider');
            }}
            className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
          >
            <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
            Continue with Google
          </Button>
        )}
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4 w-full max-w-[320px]">
        <div className="flex flex-col items-center">
          <div className="h-1 bg-emerald-500 w-8 rounded-full mb-2" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Flexibility</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="h-1 bg-emerald-500 w-8 rounded-full mb-2" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Weekly Pay</p>
        </div>
        <div className="flex flex-col items-center">
          <div className="h-1 bg-emerald-500 w-8 rounded-full mb-2" />
          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Insurance</p>
        </div>
      </div>
    </div>
  );
}
