import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useDiscoverCards, discoverActions } from "@/lib/discover-store";

export const Route = createFileRoute("/logistics/discover")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Discover More" }] }),
  component: LogisticsDiscover,
});

function LogisticsDiscover() {
  const cards = useDiscoverCards();
  return (
    <div className="space-y-5 text-left">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Discover More</h1>
          <p className="text-sm text-muted-foreground">Monitor horizontal shortcut cards on the customer home.</p>
        </div>
      </header>

      <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Icon</th>
              <th className="p-3">Title</th>
              <th className="p-3">Query</th>
              <th className="p-3">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-3 font-mono text-xs">{c.id.slice(0, 4)}</td>
                <td className="p-3">{c.icon}</td>
                <td className="p-3 font-bold">{c.title}</td>
                <td className="p-3 text-muted-foreground">{c.query}</td>
                <td className="p-3">
                   <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${c.enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                      {c.enabled ? "Active" : "Disabled"}
                   </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
