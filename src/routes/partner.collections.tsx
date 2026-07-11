import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useDiscoverCards, useCollectionRequests, collectionRequestActions } from "@/lib/discover-store";
import { restaurants } from "@/lib/mock-data";

export const Route = createFileRoute("/partner/collections")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Collections" }] }),
  component: PartnerCollections,
});

function PartnerCollections() {
  // Demo: assume the partner represents the first restaurant.
  const r = restaurants[0];
  const cards = useDiscoverCards().filter((c) => c.enabled);
  const requests = useCollectionRequests().filter((req) => req.restaurantId === r.id);
  const requestedIds = new Set(requests.map((req) => req.collectionId));

  const submit = (collectionId: string, collectionTitle: string) => {
    collectionRequestActions.submit({
      restaurantId: r.id, restaurantName: r.name, collectionId, collectionTitle,
    });
    toast.success(`Requested inclusion in "${collectionTitle}"`);
  };

  return (
    <div className="space-y-5 px-5 py-5">
      <header>
        <h1 className="font-display text-xl font-extrabold tracking-tight">Featured collections</h1>
        <p className="text-sm text-muted-foreground">Request inclusion in eligible Discover collections. Admin approval required.</p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((c) => {
          const req = requests.find((rq) => rq.collectionId === c.id);
          return (
            <div key={c.id} className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border/60">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-secondary text-lg">{c.icon}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground">{c.query}</p>
                </div>
              </div>
              <div className="mt-3">
                {req ? (
                  <span className={
                    req.status === "approved" ? "text-[11px] font-bold text-primary" :
                    req.status === "rejected" ? "text-[11px] font-bold text-destructive" :
                    "text-[11px] font-bold text-muted-foreground"
                  }>
                    {req.status === "pending" ? "Pending review" : req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </span>
                ) : (
                  <button
                    onClick={() => submit(c.id, c.title)}
                    disabled={requestedIds.has(c.id)}
                    className="w-full rounded-full bg-primary py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Request inclusion
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
