import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";
import { menuAddons } from "@/lib/mock-extras";
import { formatPrice } from "@/lib/format";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/addons")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Add-ons & variants" }] }),
  component: AddonsPage,
});

function AddonsPage() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Add-ons & variants" subtitle="Customise sizes and toppings" />

      <div className="space-y-5 px-4 pt-4">
        {menuAddons.map((m) => (
          <section key={m.dish} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold">{m.dish}</h2>
              <button className="text-[11px] font-bold uppercase tracking-wider text-primary"><Pencil className="mr-1 inline h-3 w-3" />Edit</button>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Variants</h3>
              <ul className="space-y-1.5">
                {m.variants.map((v) => (
                  <li key={v.name} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                    <span>{v.name}</span>
                    <span className="font-bold">{v.price === 0 ? "Base" : `+${formatPrice(v.price)}`}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Add-ons</h3>
              <ul className="space-y-1.5">
                {m.addons.map((a) => (
                  <li key={a.name} className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2 text-sm">
                    <span>{a.name}</span>
                    <span className="font-bold">+{formatPrice(a.price)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Button onClick={() => toast.success("Add-on added")} variant="ghost" className="mt-3 w-full rounded-2xl border-2 border-dashed border-border text-sm"><Plus className="mr-1 h-4 w-4" /> New add-on</Button>
          </section>
        ))}
      </div>
    </div>
  );
}
