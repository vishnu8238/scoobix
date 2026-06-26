import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, X, FileCheck2 } from "lucide-react";
import { restaurantApprovals } from "@/lib/mock-extras";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/approvals")({
  head: () => ({ meta: [{ title: "Cravio Admin · Restaurant approvals" }] }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const [list, setList] = useState(restaurantApprovals);
  const act = (id: string, ok: boolean) => {
    setList((p) => p.filter((r) => r.id !== id));
    toast.success(ok ? "Restaurant approved" : "Application rejected");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Restaurant approvals</h1>
        <p className="text-sm text-muted-foreground">{list.length} pending applications</p>
      </header>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-card p-12 text-center shadow-soft ring-1 ring-border/60">
          <FileCheck2 className="mx-auto h-10 w-10 text-primary" />
          <p className="mt-3 font-display text-lg font-bold">All caught up</p>
          <p className="text-sm text-muted-foreground">No restaurants waiting for review.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((r) => (
            <article key={r.id} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{r.id} · {r.submitted}</p>
                  <h3 className="mt-1 font-display text-lg font-extrabold">{r.name}</h3>
                  <p className="text-sm text-muted-foreground">{r.cuisine} · {r.city}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${r.docs === "Verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.docs}</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <Info label="Owner"   value={r.owner} />
                <Info label="Submitted" value={r.submitted} />
              </div>

              <div className="mt-5 flex items-center gap-2">
                <Button onClick={() => act(r.id, false)} variant="outline" className="flex-1 rounded-full"><X className="mr-1 h-4 w-4" /> Reject</Button>
                <Button onClick={() => act(r.id, true)} className="flex-1 rounded-full gradient-primary text-primary-foreground shadow-glow"><Check className="mr-1 h-4 w-4" /> Approve</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/60 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
