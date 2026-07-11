import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useTrendingChips, trendingActions } from "@/lib/discover-store";

export const Route = createFileRoute("/admin/trending")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Trending Now" }] }),
  component: TrendingAdmin,
});

function TrendingAdmin() {
  const chips = useTrendingChips();
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Trending Now</h1>
          <p className="text-sm text-muted-foreground">Manage trending category chips on the customer home. Toggle Auto to pull from order popularity.</p>
        </div>
        <button
          onClick={() => trendingActions.add({})}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" /> Add chip
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Name</th>
              <th className="p-3">Image URL</th>
              <th className="p-3">Starts</th>
              <th className="p-3">Ends</th>
              <th className="p-3">Auto</th>
              <th className="p-3">Enabled</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {chips.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => trendingActions.reorder(c.id, -1)} className="grid h-5 w-5 place-items-center rounded bg-muted"><ArrowUp className="h-3 w-3"/></button>
                    <button onClick={() => trendingActions.reorder(c.id, 1)} className="grid h-5 w-5 place-items-center rounded bg-muted"><ArrowDown className="h-3 w-3"/></button>
                  </div>
                </td>
                <td className="p-2"><input value={c.name} onChange={(e) => trendingActions.update(c.id, { name: e.target.value })} className="w-32 rounded bg-muted px-2 py-1" /></td>
                <td className="p-2"><input value={c.image} onChange={(e) => trendingActions.update(c.id, { image: e.target.value })} className="w-56 rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="date" value={c.startsAt?.slice(0,10) ?? ""} onChange={(e) => trendingActions.update(c.id, { startsAt: e.target.value || undefined })} className="rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="date" value={c.endsAt?.slice(0,10) ?? ""} onChange={(e) => trendingActions.update(c.id, { endsAt: e.target.value || undefined })} className="rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="checkbox" checked={!!c.auto} onChange={(e) => trendingActions.update(c.id, { auto: e.target.checked })} /></td>
                <td className="p-2"><input type="checkbox" checked={c.enabled} onChange={(e) => trendingActions.update(c.id, { enabled: e.target.checked })} /></td>
                <td className="p-2"><button onClick={() => trendingActions.remove(c.id)} className="grid h-7 w-7 place-items-center rounded bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
