import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Search, Loader2, Check, Ban } from "lucide-react";
import { toast } from "sonner";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { listTable } from "@/lib/insforge-crud";
import { setRestaurantApprovalStatus } from "@/lib/insforge";
import type { RestaurantRow } from "@/lib/partner-store";

export const Route = createFileRoute("/logistics/restaurants")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Restaurants" }] }),
  component: LogisticsRestaurants,
});

function LogisticsRestaurants() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listTable<RestaurantRow>("restaurants", { order: "created_at.desc", limit: 300 });
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = rows.filter(r => (r.name || "").toLowerCase().includes(q.toLowerCase()));

  const updateStatus = async (r: RestaurantRow, status: "approved" | "suspended") => {
    await setRestaurantApprovalStatus(r.id, status);
    toast.success(`${r.name} updated`);
    void refresh();
  };

  return (
    <div className="space-y-6 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Partner restaurants</h1>
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search restaurants…" className="h-11 w-64 rounded-2xl bg-card pl-11 shadow-soft outline-none ring-1 ring-border/60" />
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <DataTable
          columns={["ID", "Name", "Rating", "Status", "Actions"]}
          rows={filtered.map((r) => [
            <span key={r.id} className="font-mono text-xs font-bold text-primary">{r.code || r.id.slice(0,8)}</span>,
            <span key={r.id+"n"} className="font-bold">{r.name}</span>,
            <span key={r.id+"r"} className="flex items-center gap-1 font-bold text-xs"><Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {(r.rating_value ?? 0).toFixed(1)}</span>,
            <StatusBadge key={r.id+"s"} label={r.status || "Pending"} />,
            <div key={r.id+"a"} className="flex gap-1.5">
               <button onClick={() => updateStatus(r, "approved")} className="p-1.5 rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" /></button>
               <button onClick={() => updateStatus(r, "suspended")} className="p-1.5 rounded-full bg-rose-100 text-rose-700"><Ban className="h-3.5 w-3.5" /></button>
            </div>
          ])}
        />
      </section>
    </div>
  );
}
