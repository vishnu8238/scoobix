import { createFileRoute } from "@tanstack/react-router";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/manager/login")({
  head: () => ({ meta: [{ title: "Scoobix Manager · Login" }] }),
  component: ManagerLogin,
});

function ManagerLogin() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#0f766e] shadow-glow">
        <LogIn className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Manager Portal</h1>
      <p className="mt-2 text-muted-foreground max-w-[280px]">Sign in to manage your merchant operations</p>

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
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
      </div>
    </div>
  );
}
