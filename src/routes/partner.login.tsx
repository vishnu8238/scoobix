import { createFileRoute } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/partner/login")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Login" }] }),
  component: PartnerLogin,
});

function PartnerLogin() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-600 shadow-glow">
        <Store className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Partner Portal</h1>
      <p className="mt-2 text-muted-foreground">Manage your restaurant and grow with Scoobix</p>

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            login('google', 'partner');
          }}
          className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
        >
          <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
          Continue with Google
        </Button>

      </div>

      <p className="mt-10 text-[11px] text-muted-foreground max-w-[280px]">
        Join thousands of restaurants already serving happy customers on Scoobix.
      </p>
    </div>
  );
}
