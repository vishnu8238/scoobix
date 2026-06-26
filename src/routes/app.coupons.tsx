import { createFileRoute } from "@tanstack/react-router";
import { Tag, Copy, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { coupons } from "@/lib/mock-extras";
import { toast } from "sonner";

export const Route = createFileRoute("/app/coupons")({
  head: () => ({ meta: [{ title: "Cravio · Coupons & offers" }] }),
  component: CouponsPage,
});

function CouponsPage() {
  const copy = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast.success(`${code} copied · paste at checkout`);
  };

  return (
    <div className="min-h-svh pb-16">
      <PageHeader title="Coupons & offers" subtitle={`${coupons.length} active`} />

      <div className="px-4 pt-4">
        <div className="rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-90"><Sparkles className="h-3.5 w-3.5" /> Cravio Plus</div>
          <h2 className="mt-2 font-display text-xl font-extrabold leading-tight">Unlock free delivery on every order</h2>
          <p className="mt-1 text-[12.5px] opacity-90">Try Cravio Plus for ₹149/month. Cancel anytime.</p>
        </div>
      </div>

      <ul className="mt-6 space-y-3 px-4">
        {coupons.map((c) => (
          <li key={c.code} className="relative overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
            <div className="flex items-stretch">
              <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-primary-soft p-3 text-primary">
                <Tag className="h-5 w-5" strokeWidth={2.6} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Offer</span>
              </div>
              <div className="relative flex-1 p-4">
                <div className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-background" />
                <h3 className="text-sm font-bold">{c.title}</h3>
                <p className="text-xs text-muted-foreground">{c.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[12px] font-bold tracking-wider">{c.code}</span>
                  <button onClick={() => copy(c.code)} className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-primary"><Copy className="h-3 w-3" /> Copy</button>
                </div>
                <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expires {c.expires}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
