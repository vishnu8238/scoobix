import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { ArrowLeft, Users, Copy, ShoppingBag, Lock, LockOpen, UserMinus, PowerOff } from "lucide-react";
import { useGroupCart } from "@/lib/scoobix-extras";
import { useCart } from "@/lib/stores";
import { useAuth } from "@/lib/auth-store";
import { qrUrl } from "@/lib/scoobix-loyalty";
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
  const { getSession, joinSession, lockSession, removeMember, closeSession, syncItems, subtotalFor } = useGroupCart();
  const { items, totals } = useCart();

  useEffect(() => {
    if (!user) return;
    joinSession(sessionId, { id: user.id, name: user.name });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id]);

  const session = getSession(sessionId);
  const isHost = !!user && !!session && session.hostId === user.id;
  const memberId = user?.id ?? "guest";

  // Tag any new cart line to the current participant.
  useEffect(() => {
    if (!session) return;
    syncItems(sessionId, memberId, items.map((it) => ({ lineId: it.lineId, name: it.name, price: it.price, qty: it.qty })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, memberId, items.length, items.map((i) => `${i.lineId}:${i.qty}`).join("|")]);

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/app/group/${sessionId}` : `https://scoobix.app/app/group/${sessionId}`;
  const qr = useMemo(() => qrUrl(inviteUrl, 200), [inviteUrl]);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "Join my Scoobix cart", url: inviteUrl });
      else { await navigator.clipboard.writeText(inviteUrl); toast.success("Invite link copied"); }
    } catch { /* cancelled */ }
  };

  const ownItems = session?.itemOwners.filter((o) => o.memberId === memberId) ?? [];
  const canEditLine = (lineId: string) => !!session?.itemOwners.find((o) => o.lineId === lineId && o.memberId === memberId);
  const nameOf = (mid: string) => session?.members.find((m) => m.id === mid)?.name ?? "Guest";

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
          <p className="eyebrow flex items-center gap-1"><Users className="h-3 w-3" /> Session · #{sessionId}</p>
          <h2 className="mt-0.5 font-display text-lg font-extrabold">{session?.restaurantName ?? "Shared cart"}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {session?.closed ? "This group has been closed by the host." : session?.locked ? "Host has locked the group — no new joiners." : "Anyone with the link or QR code can join. Each person edits only their own dishes."}
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
            <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3 ring-1 ring-border/60">
              <img src={qr} alt="Scan to join group cart" width={160} height={160} loading="lazy" decoding="async" className="rounded-xl" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground">Participants ({session?.members.length ?? 0})</p>
              <ul className="mt-2 space-y-1.5">
                {(session?.members ?? []).map((m) => {
                  const st = subtotalFor(sessionId, m.id);
                  return (
                    <li key={m.id} className="flex items-center justify-between gap-2 rounded-full bg-secondary px-3 py-1 text-xs">
                      <span className="truncate font-bold">
                        {m.name}{session?.hostId === m.id ? " · host" : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">₹{st.toFixed(2)}</span>
                        {isHost && m.id !== session?.hostId && !session?.closed && (
                          <button onClick={() => removeMember(sessionId, m.id)} className="grid h-6 w-6 place-items-center rounded-full bg-background text-rose-600" aria-label={`Remove ${m.name}`}>
                            <UserMinus className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={share} className="rounded-full gradient-primary text-primary-foreground shadow-glow">
                  <Copy className="mr-2 h-4 w-4" /> Copy invite link
                </Button>
                {isHost && !session?.closed && (
                  <>
                    <Button variant="outline" onClick={() => lockSession(sessionId, !session?.locked)} className="rounded-full">
                      {session?.locked ? <LockOpen className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                      {session?.locked ? "Unlock" : "Lock"}
                    </Button>
                    <Button variant="outline" onClick={() => { closeSession(sessionId); toast.success("Group closed"); }} className="rounded-full text-rose-600">
                      <PowerOff className="mr-2 h-4 w-4" /> Close group
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-card ring-1 ring-border/60">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h3 className="font-display text-lg font-extrabold">Combined cart</h3>
          </div>
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No items yet — browse and add dishes from the same restaurant.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border/60">
              {items.map((it) => {
                const owner = session?.itemOwners.find((o) => o.lineId === it.lineId);
                const mine = !owner || owner.memberId === memberId;
                return (
                  <li key={it.lineId} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate">
                        <span className="font-bold text-primary">{it.qty}×</span> {it.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        by {mine ? "you" : nameOf(owner!.memberId)}{!canEditLine(it.lineId) && !mine ? " · locked" : ""}
                      </span>
                    </span>
                    <span className="font-semibold">₹{(it.price * it.qty).toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-3 rounded-2xl bg-secondary/60 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span>Your subtotal</span>
              <span className="font-bold">₹{ownItems.reduce((s, o) => s + o.price * o.qty, 0).toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Group total</span>
              <span className="font-bold">₹{totals.total.toFixed(2)}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate({ to: "/app" })} variant="outline" className="flex-1 rounded-full">Add dishes</Button>
            <Button
              onClick={() => navigate({ to: "/app/checkout" })}
              disabled={items.length === 0 || !!session?.closed}
              className="flex-1 rounded-full gradient-primary text-primary-foreground shadow-glow"
            >
              Checkout · ₹{totals.total.toFixed(2)}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
