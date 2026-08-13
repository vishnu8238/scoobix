import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useTrendingChips, trendingActions } from "@/lib/discover-store";

export const Route = createFileRoute("/logistics/trending")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Trending Now" }] }),
  component: LogisticsTrending,
});

function LogisticsTrending() {
  const chips = useTrendingChips();
  return (
    <div className="space-y-5 text-left">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Trending Now</h1>
          <p className="text-sm text-muted-foreground">Manage trending category chips on the customer home.</p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Auto</th>
              <th className="p-3">Enabled</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {chips.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-3 font-bold">{c.name}</td>
                <td className="p-3">{c.auto ? "Yes" : "No"}</td>
                <td className="p-3">
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {c.enabled ? "Active" : "Disabled"}
                   </span>
                </td>
                <td className="p-3">
                   <button onClick={() => trendingActions.update(c.id, { enabled: !c.enabled })} className="text-[10px] font-bold text-primary uppercase">Toggle</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
