import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Sparkles, Save } from "lucide-react";
import { useSpotlight, type SpotlightContent } from "@/lib/scoobix-extras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/logistics/spotlight")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Spotlight" }] }),
  component: LogisticsSpotlight,
});

function LogisticsSpotlight() {
  const { spotlight, update } = useSpotlight();
  const [draft, setDraft] = useState<SpotlightContent>(spotlight!);

  const save = () => { update(draft); toast.success("Spotlight updated"); };

  return (
    <div className="space-y-6 text-left">
      <header>
        <p className="eyebrow">Weekly Spotlight</p>
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Scoobix Spotlight</h1>
        <p className="mt-1 text-sm text-muted-foreground">Featured cuisine, restaurant, or combo.</p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <div className="space-y-3">
            <div>
              <p className="eyebrow">Type</p>
              <div className="mt-1 grid grid-cols-3 gap-2">
                {(["restaurant", "cuisine", "combo"] as const).map((k) => (
                  <button key={k} onClick={() => setDraft({ ...draft, kind: k })}
                    className={cn("rounded-2xl border-2 py-2 text-sm font-bold capitalize", draft.kind === k ? "border-primary bg-primary-soft text-primary" : "border-border bg-card")}>
                    {k}
                  </button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="eyebrow">Title</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="mt-1 w-full rounded-2xl bg-muted/50 px-4 py-2 outline-none" />
            </label>
            <label className="block">
              <span className="eyebrow">Subtitle</span>
              <textarea value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} className="mt-1 w-full rounded-2xl bg-muted/50 px-4 py-2 outline-none" rows={3} />
            </label>
            <Button onClick={save} className="h-12 w-full rounded-2xl gradient-primary text-primary-foreground shadow-glow"><Save className="mr-2 h-4 w-4" /> Save spotlight</Button>
          </div>
        </div>

        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
          <p className="eyebrow">Live preview</p>
          <div className="mt-3 overflow-hidden rounded-2xl bg-secondary">
            <div className="relative h-44">
              <img src={draft.image} alt="" className="h-full w-full object-cover" />
            </div>
            <div className="p-4">
              <p className="eyebrow">Scoobix Spotlight</p>
              <h3 className="mt-0.5 font-display text-lg font-extrabold">{draft.title}</h3>
              <p className="text-xs text-muted-foreground">{draft.subtitle}</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
