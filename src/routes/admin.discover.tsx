import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useDiscoverCards, discoverActions } from "@/lib/discover-store";

export const Route = createFileRoute("/admin/discover")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Discover More" }] }),
  component: DiscoverAdmin,
});

function DiscoverAdmin() {
  const cards = useDiscoverCards();
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Discover More</h1>
          <p className="text-sm text-muted-foreground">Manage the horizontal shortcut cards on the customer home.</p>
        </div>
        <button
          onClick={() => discoverActions.add({})}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" /> Add card
        </button>
      </header>

      <div className="overflow-hidden rounded-2xl bg-card shadow-soft ring-1 ring-border/60">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">Icon</th>
              <th className="p-3">Title</th>
              <th className="p-3">Query / filter</th>
              <th className="p-3">Image URL</th>
              <th className="p-3">Color</th>
              <th className="p-3">Starts</th>
              <th className="p-3">Ends</th>
              <th className="p-3">Enabled</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-t border-border/60">
                <td className="p-2">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => discoverActions.reorder(c.id, -1)} className="grid h-5 w-5 place-items-center rounded bg-muted"><ArrowUp className="h-3 w-3"/></button>
                    <button onClick={() => discoverActions.reorder(c.id, 1)} className="grid h-5 w-5 place-items-center rounded bg-muted"><ArrowDown className="h-3 w-3"/></button>
                  </div>
                </td>
                <td className="p-2"><input value={c.icon} onChange={(e) => discoverActions.update(c.id, { icon: e.target.value })} className="w-12 rounded bg-muted px-2 py-1 text-center" /></td>
                <td className="p-2"><input value={c.title} onChange={(e) => discoverActions.update(c.id, { title: e.target.value })} className="w-32 rounded bg-muted px-2 py-1" /></td>
                <td className="p-2"><input value={c.query} onChange={(e) => discoverActions.update(c.id, { query: e.target.value })} className="w-32 rounded bg-muted px-2 py-1" /></td>
                <td className="p-2"><input value={c.image ?? ""} onChange={(e) => discoverActions.update(c.id, { image: e.target.value })} placeholder="https://…" className="w-40 rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="color" value={c.color ?? "#28a156"} onChange={(e) => discoverActions.update(c.id, { color: e.target.value })} className="h-8 w-10 rounded" /></td>
                <td className="p-2"><input type="date" value={c.startsAt?.slice(0,10) ?? ""} onChange={(e) => discoverActions.update(c.id, { startsAt: e.target.value || undefined })} className="rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="date" value={c.endsAt?.slice(0,10) ?? ""} onChange={(e) => discoverActions.update(c.id, { endsAt: e.target.value || undefined })} className="rounded bg-muted px-2 py-1 text-xs" /></td>
                <td className="p-2"><input type="checkbox" checked={c.enabled} onChange={(e) => discoverActions.update(c.id, { enabled: e.target.checked })} /></td>
                <td className="p-2"><button onClick={() => discoverActions.remove(c.id)} className="grid h-7 w-7 place-items-center rounded bg-destructive/10 text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
