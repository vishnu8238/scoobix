import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/customer/login")({
  head: () => ({ meta: [{ title: "Scoobix · Customer Login" }] }),
  component: CustomerLogin,
});

function CustomerLogin() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: "/app", replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-glow">
        <Search className="h-10 w-10 text-primary-foreground" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to continue your food journey</p>

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
        <Button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            login('google', 'customer');
          }}
          className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
        >
          <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
          Continue with Google
        </Button>
      </div>

      <p className="mt-10 text-[11px] text-muted-foreground max-w-[280px]">
        By continuing, you agree to Scoobix’s Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
