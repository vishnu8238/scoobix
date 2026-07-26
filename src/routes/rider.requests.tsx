import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/lib/format";
import { Check, X, MapPin, Package, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { acceptDeliveryRequest } from "@/lib/insforge";
import { nudgeTable } from "@/lib/realtime";
import { useLiveOrders } from "@/lib/realtime-hooks";
import { markOfferAccepted, markOfferRejected, OFFER_TIMEOUT_SEC } from "@/lib/dispatch-engine";
import { useDriver } from "@/lib/driver-store";
import { listTable } from "@/lib/insforge-crud";

export const Route = createFileRoute("/rider/requests")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Requests" }] }),
  component: RiderRequests,
});

type OrderRow = {
  id: string;
  restaurant_id?: string;
  customer_id?: string;
  total_price?: number;
  delivery_fee?: number;
  delivery_address?: string;
  status?: string;
  driver_id?: string | null;
  items?: unknown;
};

type RestaurantRow = { id: string; name?: string; address?: string; latitude?: number; longitude?: number };

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function countItems(items: unknown): number {
  const lines = Array.isArray(items) ? items : ((items as { lines?: unknown[] } | null)?.lines ?? []);
  return Array.isArray(lines) ? lines.reduce((n, l) => n + Number((l as { qty?: number }).qty ?? 1), 0) : 0;
}

function RiderRequests() {
  const { driver, driverId, loading: driverLoading } = useDriver();
  // Live offers targeted at this driver.
  const { rows } = useLiveOrders({ driver_id: driverId || "__none__", status: "ASSIGNING" });

  const [restaurants, setRestaurants] = useState<Record<string, RestaurantRow>>({});

  useEffect(() => {
    void listTable<RestaurantRow>("restaurants", { limit: 300 }).then((rs) => {
      const map: Record<string, RestaurantRow> = {};
      for (const r of rs) map[String(r.id)] = r;
      setRestaurants(map);
    });
  }, []);

  // Track first-seen time per offer to drive the 60-second countdown.
  const seenRef = useState<Map<string, number>>(new Map())[0];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    for (const r of rows) {
      const id = String((r as OrderRow).id);
      if (!seenRef.has(id)) seenRef.set(id, Date.now());
    }
    for (const id of Array.from(seenRef.keys())) {
      if (!rows.find((r) => String((r as OrderRow).id) === id)) seenRef.delete(id);
    }
  }, [rows, seenRef]);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);

  const list = useMemo(() => {
    const here = typeof driver?.current_lat === "number" && typeof driver?.current_lng === "number"
      ? { lat: driver.current_lat as number, lng: driver.current_lng as number }
      : null;

    return (rows as OrderRow[]).map((row) => {
      const rest = restaurants[String(row.restaurant_id ?? "")];
      const km = here && typeof rest?.latitude === "number" && typeof rest?.longitude === "number"
        ? haversineKm(here, { lat: rest.latitude, lng: rest.longitude })
        : null;
      return {
        id: String(row.id),
        restaurant: rest?.name ?? "Restaurant",
        restaurantAddress: rest?.address ?? "—",
        customerAddress: row.delivery_address ?? "—",
        distanceKm: km === null ? null : Number(km.toFixed(1)),
        etaMins: km === null ? null : Math.max(10, Math.round(km * 4)),
        itemsCount: countItems(row.items),
        payout: Number(row.delivery_fee ?? 0) || 0,
      };
    });
  }, [rows, restaurants, driver?.current_lat, driver?.current_lng]);

  const decide = async (id: string, accept: boolean) => {
    if (!driverId) {
      toast.error("Driver profile not ready — try again in a moment");
      return;
    }
    if (accept) {
      markOfferAccepted(id);
      await acceptDeliveryRequest(id, driverId);
      nudgeTable("orders");
      toast.success("Accepted — head to pickup");
    } else {
      await markOfferRejected(id);
      toast.success("Request declined");
    }
  };

  return (
    <div className="animate-fade-up px-5 pt-7">
      <header className="mb-5">
        <p className="eyebrow">Delivery Requests</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight">New nearby trips</h1>
      </header>

      {driverLoading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl bg-card p-10 text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-3xl bg-card p-10 text-center shadow-soft ring-1 ring-border/60">
          <p className="font-display text-lg font-bold">No requests yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Stay online — we'll ping you when one comes in.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((r) => {
            const seenAt = seenRef.get(r.id) ?? now;
            const remaining = Math.max(0, OFFER_TIMEOUT_SEC - Math.floor((now - seenAt) / 1000));
            return (
              <div key={r.id} className="overflow-hidden rounded-3xl bg-card shadow-card ring-1 ring-border/60">
                <div className="flex items-start gap-3 bg-gradient-to-br from-primary/10 to-transparent p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                          #{r.id.slice(-5).toUpperCase()} · {remaining}s
                        </p>
                        <h3 className="font-display text-base font-extrabold">{r.restaurant}</h3>
                      </div>
                      <span className="font-display text-xl font-extrabold text-primary">{formatPrice(r.payout)}</span>
                    </div>
                    <div className="mt-2 flex gap-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {r.distanceKm !== null && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.distanceKm} km</span>}
                      {r.etaMins !== null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.etaMins} min</span>}
                      <span>· {r.itemsCount} items</span>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 space-y-2 text-xs">
                  <div className="flex gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                    <div>
                      <p className="font-bold">Pickup · {r.restaurant}</p>
                      <p className="text-muted-foreground">{r.restaurantAddress}</p>
                    </div>
                  </div>
                  <div className="ml-1 h-3 w-px bg-border" />
                  <div className="flex gap-2">
                    <span className="mt-0.5 h-2 w-2 rounded-full bg-foreground" />
                    <div>
                      <p className="font-bold">Drop-off</p>
                      <p className="text-muted-foreground">{r.customerAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border/60 p-3">
                  <button onClick={() => decide(r.id, false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-muted px-4 py-3 text-sm font-bold text-muted-foreground transition active:scale-95">
                    <X className="h-4 w-4" /> Reject
                  </button>
                  <button onClick={() => decide(r.id, true)} className="flex flex-[2] items-center justify-center gap-1.5 rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95">
                    <Check className="h-4 w-4" /> Accept delivery
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
