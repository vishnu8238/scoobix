import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut, Power, Zap, Wallet, Clock } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/auth-store";
import { useCms } from "@/lib/cms-store";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { updateRestaurantStatus } from "@/lib/insforge";

export const Route = createFileRoute("/partner/settings")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Settings" }] }),
  component: PartnerSettings,
});

function PartnerSettings() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { restaurant, restaurantId, update } = usePartnerRestaurant();
  const { closedRestaurants, setRestaurantClosed, acceptingOrders, setAcceptingOrders } = useCms();

  const isClosed = !!closedRestaurants[restaurantId];
  const isAccepting = acceptingOrders[restaurantId] !== false;
  const autoAccept = restaurant?.auto_accept_orders === true;

  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Settings" subtitle="Store & account" />

      <section className="mx-4 mt-4 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
        <Row icon={Power} title="Store open" desc={isClosed ? "Customers cannot order right now" : "Visible & orderable"}>
          <Switch
            checked={!isClosed}
            onCheckedChange={(v) => {
              if (!restaurantId) return;
              void updateRestaurantStatus(restaurantId, { is_open: v });
              setRestaurantClosed(restaurantId, !v);
              toast.success(v ? "Store is open" : "Store closed");
            }}
          />
        </Row>
        <Row icon={Zap} title="Accept new orders" desc={isAccepting ? "New orders arrive in the queue" : "New orders are paused"}>
          <Switch checked={isAccepting} onCheckedChange={(v) => { if (restaurantId) setAcceptingOrders(restaurantId, v); }} />
        </Row>
        <Row icon={Clock} title="Auto-accept orders" desc="Skip manual approval for incoming orders">
          <Switch checked={autoAccept} onCheckedChange={(v) => { void update({ auto_accept_orders: v }); }} />
        </Row>
        <Row icon={Wallet} title="Payout cycle" desc="Set by Scoobix admin">
          <span className="text-sm font-bold">{restaurant?.payout_cycle_hours ?? 24}h</span>
        </Row>
      </section>

      <button
        onClick={() => { signOut(); toast.success("Signed out"); navigate({ to: "/auth/login" }); }}
        className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-3xl bg-card px-4 py-3.5 text-left shadow-soft ring-1 ring-border/60 transition active:bg-muted/40"
      >
        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-rose-100 text-rose-700"><LogOut className="h-5 w-5" strokeWidth={2.4} /></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Sign out</div>
          <div className="truncate text-xs text-muted-foreground">{user?.email}</div>
        </div>
      </button>
    </div>
  );
}

function Row({ icon: Icon, title, desc, children }: { icon: any; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><Icon className="h-5 w-5" strokeWidth={2.4} /></span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      {children}
    </div>
  );
}
