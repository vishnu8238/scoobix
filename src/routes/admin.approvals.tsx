import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, X, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listTable, patchRecord } from "@/lib/insforge-crud";
import { notifyManagerDecision, type ManagedRestaurant } from "@/lib/manager-api";

export const Route = createFileRoute("/admin/approvals")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Restaurant approvals" }] }),
  component: ApprovalsPage,
});

type Row = {
  id: string;
  name?: string;
  address?: string;
  status?: string;
  created_at?: string;
  owner_id?: string | null;
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(); } catch { return "—"; }
}

function ApprovalsPage() {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listTable<Row>("restaurants", { limit: 200 });
      if (cancelled) return;
      setList(rows.filter((r) => (r.status ?? "").toLowerCase() === "pending"));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const act = async (id: string, ok: boolean) => {
    const row = list.find((r) => r.id === id);
    setList((p) => p.filter((r) => r.id !== id));
    const status = ok ? "active" : "rejected";
    const res = await patchRecord("restaurants", id, {
      status,
      onboarding_status: ok ? "live" : "rejected",
      ...(ok ? { approved_at: new Date().toISOString() } : {}),
    });
    if (res === null) toast.error("Backend update failed — retry later");
    else toast.success(ok ? "Restaurant approved" : "Application rejected");
    if (res !== null && row) {
      const full = await listTable<ManagedRestaurant>("restaurants", { id: `eq.${id}`, limit: 1 });
      if (full[0]) {
        await notifyManagerDecision({
          restaurant: full[0],
          decision: ok ? "live" : "rejected",
          note: ok ? "Approved and set live." : "Application rejected by admin.",
        });
      }
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Restaurant approvals</h1>
        <p className="text-sm text-muted-foreground">{loading ? "Loading…" : `${list.length} pending applications`}</p>
      </header>

      {!loading && list.length === 0 ? (
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
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{r.id.slice(0, 8)} · {fmtDate(r.created_at)}</p>
                  <h3 className="mt-1 font-display text-lg font-extrabold">{r.name ?? "—"}</h3>
                  <p className="text-sm text-muted-foreground">{r.address ?? "No address"}</p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-700">Pending</span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <Info label="Owner"     value={r.owner_id ? r.owner_id.slice(0, 8) : "—"} />
                <Info label="Submitted" value={fmtDate(r.created_at)} />
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
