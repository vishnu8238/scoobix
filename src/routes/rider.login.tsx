import { createFileRoute } from "@tanstack/react-router";
import { Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/rider/login")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Login" }] }),
  component: RiderLogin,
});

function RiderLogin() {
  const { login } = useAuth();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center px-6 text-center animate-fade-up bg-zinc-50">
      <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-600 shadow-glow">
        <Bike className="h-10 w-10 text-white" strokeWidth={2.5} />
      </div>
      
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Rider App</h1>
      <p className="mt-2 text-muted-foreground">Earn on your schedule. Deliver with Scoobix.</p>

      <div className="mt-10 w-full space-y-4 max-w-[320px]">
        <Button 
          onClick={() => {
            console.log("[GOOGLE_OAUTH] BUTTON_CLICKED - UI (Rider)");
            login('google', 'rider');
          }}
          className="h-14 w-full rounded-2xl bg-white text-black ring-1 ring-border shadow-soft hover:bg-zinc-50 font-bold"
        >
          <img src="https://www.google.com/favicon.ico" className="mr-3 h-5 w-5" alt="" />
          Continue with Google
        </Button>

        <Button 
          onClick={() => login('apple', 'rider')}
          className="h-14 w-full rounded-2xl bg-black text-white shadow-pop hover:bg-zinc-900 font-bold"
        >
          <img src="https://appleid.cdn-apple.com/appleauth/static/bin/cb126075202/images/favicon.ico" className="mr-3 h-5 w-5 invert" alt="" />
          Continue with Apple
        </Button>
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
