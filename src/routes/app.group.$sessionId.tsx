import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import { ArrowLeft, Users, Copy, ShoppingBag } from "lucide-react";
import { useGroupCart } from "@/lib/scoobix-extras";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/app/group/$sessionId")({
  head: () => ({ meta: [
    { title: "Scoobix Group Cart" },
    { name: "description", content: "Shared cart — everyone adds their dishes, one checkout." },
  ] }),
  component: GroupCartPage,
});

function GroupCartPage() {
  const { sessionId } = useParams({ from: "/app/group/$sessionId" });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getSession, joinSession } = useGroupCart();
  const { items, totals } = useCart();

  useEffect(() => {
    if (!user) return;
    joinSession(sessionId, { id: user.id, name: user.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id]);

  const session = getSession(sessionId);

  const share = async () => {
    const url = `${window.location.origin}/app/group/${sessionId}`;
    try {
      if (navigator.share) await navigator.share({ title: "Join my Scoobix cart", url });
      else { await navigator.clipboard.writeText(url); toast.success("Invite link copied"); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="min-h-svh pb-28">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button onClick={() => navigate({ to: "/app" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Group Cart</h1>
          <button onClick={share} className="grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"><Copy className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="p-4 space-y-4">
        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <p className="eyebrow flex items-center gap-1"><Users className="h-3 w-3" /> Session</p>
          <h2 className="mt-0.5 font-display text-lg font-extrabold">{session?.restaurantName ?? "Shared cart"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Everyone in this session shares one cart. Anyone can add dishes; one person checks out.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(session?.members ?? []).map((m) => (
              <span key={m.id} className="rounded-full bg-secondary px-3 py-1 text-xs font-bold">{m.name}</span>
            ))}
          </div>
          <Button onClick={share} className="mt-4 h-12 w-full rounded-full gradient-primary text-primary-foreground shadow-glow">
            <Copy className="mr-2 h-4 w-4" /> Copy invite link
          </Button>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-extrabold">Cart</h3>
          </div>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No items yet — browse and add dishes from the same restaurant.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {items.map((it) => (
                <li key={it.lineId} className="flex items-center justify-between py-2 text-sm">
                  <span><span className="font-bold text-primary">{it.qty}×</span> {it.name}</span>
                  <span className="font-semibold">₹{(it.price * it.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate({ to: "/app" })} variant="outline" className="flex-1 rounded-full">Add dishes</Button>
            <Button onClick={() => navigate({ to: "/app/checkout" })} disabled={items.length === 0} className="flex-1 rounded-full gradient-primary text-primary-foreground shadow-glow">
              Checkout · ₹{totals.total.toFixed(2)}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
