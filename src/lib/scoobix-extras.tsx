/**
 * Scoobix feature extensions store.
 *
 *  - Daily Meal Plan subscriptions  → `meal_subscriptions`
 *  - Corporate / Bulk order requests → `bulk_requests`
 *  - Group cart sessions             → `app_settings` KV rows (`group_cart:<id>`)
 *  - Weekly Spotlight                → `app_settings` KV row (`spotlight`)
 *
 * Everything is server backed; no localStorage is used in this module.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { kvGet, kvSet } from "./kv-store";
import { useAuth } from "./auth-store";

const uid = () => Math.random().toString(36).slice(2, 10);

/* ============================================================
   MEAL PLAN
   ============================================================ */

export type MealPlanSubscription = {
  id: string;
  restaurantId: string;
  restaurantName: string;
  plan: "weekly" | "monthly";
  meals: "lunch" | "dinner" | "both";
  startsOn: string; // yyyy-mm-dd
  addressLabel: string;
  price: number;
  paused: boolean;
  skippedDates: string[];
  createdAt: number;
};

type MealRow = {
  id?: string;
  customer_id?: string;
  restaurant_id?: string;
  plan_name?: string;
  meal_type?: string;
  frequency?: string;
  start_date?: string;
  end_date?: string;
  amount?: number;
  status?: string;
  created_at?: string;
};

type MealPlanCtx = {
  subs: MealPlanSubscription[];
  create: (input: Omit<MealPlanSubscription, "id" | "paused" | "skippedDates" | "createdAt">) => MealPlanSubscription;
  pause: (id: string) => void;
  resume: (id: string) => void;
  skipDate: (id: string, isoDate: string) => void;
  cancel: (id: string) => void;
  nextDayCount: (restaurantId: string) => { lunch: number; dinner: number };
};

const MPContext = createContext<MealPlanCtx | null>(null);

/** Skips have no column — stored as a KV side-car keyed by subscription id. */
const SKIP_KEY = "meal_plan_skips";

function rowToSub(r: MealRow, names: Record<string, string>, skips: Record<string, string[]>): MealPlanSubscription {
  return {
    id: r.id ?? uid(),
    restaurantId: r.restaurant_id ?? "",
    restaurantName: names[r.restaurant_id ?? ""] ?? "Restaurant",
    plan: (r.frequency as MealPlanSubscription["plan"]) ?? "weekly",
    meals: (r.meal_type as MealPlanSubscription["meals"]) ?? "lunch",
    startsOn: (r.start_date ?? "").slice(0, 10),
    addressLabel: r.plan_name ?? "",
    price: Number(r.amount ?? 0),
    paused: r.status === "paused",
    skippedDates: skips[r.id ?? ""] ?? [],
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  };
}

export function MealPlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subs, setSubs] = useState<MealPlanSubscription[]>([]);
  const [skips, setSkips] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const [rows, rests, storedSkips] = await Promise.all([
      listTable<MealRow>("meal_subscriptions", { limit: 500, order: "-created_at" }),
      listTable<{ id: string; name?: string }>("restaurants", { limit: 500 }),
      kvGet<Record<string, string[]>>(SKIP_KEY),
    ]);
    const names: Record<string, string> = {};
    for (const r of rests) names[r.id] = r.name ?? "Restaurant";
    const sk = storedSkips ?? {};
    setSkips(sk);
    setSubs(rows.filter((r) => r.status !== "cancelled").map((r) => rowToSub(r, names, sk)));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create: MealPlanCtx["create"] = (input) => {
    const sub: MealPlanSubscription = { ...input, id: uid(), paused: false, skippedDates: [], createdAt: Date.now() };
    setSubs((prev) => [sub, ...prev]);
    void createRecord<MealRow>("meal_subscriptions", {
      customer_id: user?.id ?? null,
      restaurant_id: sub.restaurantId,
      plan_name: sub.addressLabel,
      meal_type: sub.meals,
      frequency: sub.plan,
      start_date: sub.startsOn,
      amount: sub.price,
      status: "active",
    }).then((row) => {
      if (row?.id) setSubs((prev) => prev.map((s) => (s.id === sub.id ? { ...s, id: row.id! } : s)));
    });
    return sub;
  };

  const patch = (id: string, p: Partial<MealPlanSubscription>, remote: Record<string, unknown>) => {
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, ...p } : s)));
    void patchRecord("meal_subscriptions", id, remote);
  };

  const pause = (id: string) => patch(id, { paused: true }, { status: "paused" });
  const resume = (id: string) => patch(id, { paused: false }, { status: "active" });

  const skipDate = (id: string, isoDate: string) => {
    const cur = subs.find((s) => s.id === id);
    if (!cur || cur.skippedDates.includes(isoDate)) return;
    const next = { ...skips, [id]: [...(skips[id] ?? []), isoDate] };
    setSkips(next);
    setSubs((prev) => prev.map((s) => (s.id === id ? { ...s, skippedDates: next[id] } : s)));
    void kvSet(SKIP_KEY, next);
  };

  const cancel = (id: string) => {
    setSubs((prev) => prev.filter((s) => s.id !== id));
    void patchRecord("meal_subscriptions", id, { status: "cancelled" });
  };

  const nextDayCount: MealPlanCtx["nextDayCount"] = (restaurantId) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    let lunch = 0,
      dinner = 0;
    for (const s of subs) {
      if (s.restaurantId !== restaurantId || s.paused) continue;
      if (s.skippedDates.includes(tomorrow)) continue;
      if (s.meals === "lunch" || s.meals === "both") lunch++;
      if (s.meals === "dinner" || s.meals === "both") dinner++;
    }
    return { lunch, dinner };
  };

  return (
    <MPContext.Provider value={{ subs, create, pause, resume, skipDate, cancel, nextDayCount }}>
      {children}
    </MPContext.Provider>
  );
}

export const useMealPlan = () => {
  const c = useContext(MPContext);
  if (!c) throw new Error("useMealPlan must be used within MealPlanProvider");
  return c;
};

/* ============================================================
   BULK / CORPORATE REQUESTS
   ============================================================ */

export type BulkRequest = {
  id: string;
  customerId: string;
  customerName: string;
  restaurantId?: string;
  restaurantName?: string;
  eventDate: string;
  eventTime: string;
  guestCount: number;
  budget: number;
  notes?: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
};

type BulkRow = {
  id?: string;
  customer_id?: string;
  restaurant_id?: string;
  company_name?: string;
  event_date?: string;
  guests?: number;
  budget?: number;
  notes?: string;
  status?: BulkRequest["status"];
  created_at?: string;
};

type BulkCtx = {
  requests: BulkRequest[];
  create: (input: Omit<BulkRequest, "id" | "status" | "createdAt">) => BulkRequest;
  updateStatus: (id: string, status: BulkRequest["status"]) => void;
  forRestaurant: (restaurantId: string) => BulkRequest[];
};

const BulkContext = createContext<BulkCtx | null>(null);

export function BulkProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<BulkRequest[]>([]);

  const load = useCallback(async () => {
    const [rows, rests] = await Promise.all([
      listTable<BulkRow>("bulk_requests", { limit: 500, order: "-created_at" }),
      listTable<{ id: string; name?: string }>("restaurants", { limit: 500 }),
    ]);
    const names: Record<string, string> = {};
    for (const r of rests) names[r.id] = r.name ?? "Restaurant";
    setRequests(
      rows.map((r) => {
        const when = r.event_date ?? "";
        return {
          id: r.id ?? uid(),
          customerId: r.customer_id ?? "",
          customerName: r.company_name ?? "Customer",
          restaurantId: r.restaurant_id ?? undefined,
          restaurantName: r.restaurant_id ? names[r.restaurant_id] : undefined,
          eventDate: when.slice(0, 10),
          eventTime: when.slice(11, 16),
          guestCount: Number(r.guests ?? 0),
          budget: Number(r.budget ?? 0),
          notes: r.notes ?? undefined,
          status: r.status ?? "pending",
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        };
      }),
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create: BulkCtx["create"] = (input) => {
    const req: BulkRequest = { ...input, id: uid(), status: "pending", createdAt: Date.now() };
    setRequests((p) => [req, ...p]);
    void createRecord<BulkRow>("bulk_requests", {
      customer_id: input.customerId || null,
      restaurant_id: input.restaurantId || null,
      company_name: input.customerName,
      event_date: `${input.eventDate}T${input.eventTime || "12:00"}`,
      guests: input.guestCount,
      budget: input.budget,
      notes: input.notes ?? null,
      status: "pending",
    }).then((row) => {
      if (row?.id) setRequests((p) => p.map((r) => (r.id === req.id ? { ...r, id: row.id! } : r)));
    });
    return req;
  };

  const updateStatus: BulkCtx["updateStatus"] = (id, status) => {
    setRequests((p) => p.map((r) => (r.id === id ? { ...r, status } : r)));
    void patchRecord("bulk_requests", id, { status });
  };

  const forRestaurant: BulkCtx["forRestaurant"] = (rid) =>
    requests.filter((r) => !r.restaurantId || r.restaurantId === rid);

  return <BulkContext.Provider value={{ requests, create, updateStatus, forRestaurant }}>{children}</BulkContext.Provider>;
}

export const useBulk = () => {
  const c = useContext(BulkContext);
  if (!c) throw new Error("useBulk must be used within BulkProvider");
  return c;
};

/* ============================================================
   SPOTLIGHT (weekly featured content — admin controlled)
   ============================================================ */

export type SpotlightContent = {
  kind: "restaurant" | "cuisine" | "combo";
  title: string;
  subtitle: string;
  image: string;
  targetId?: string;
  sponsored?: boolean;
  updatedAt: number;
};

type SpotlightCtx = {
  spotlight: SpotlightContent | null;
  update: (patch: Partial<SpotlightContent>) => void;
};

const SPContext = createContext<SpotlightCtx | null>(null);

const DEFAULT_SPOTLIGHT: SpotlightContent = {
  kind: "cuisine",
  title: "Scoobix Spotlight · This week",
  subtitle: "Handpicked flavours from your city's best kitchens",
  image: "",
  updatedAt: Date.now(),
};

export function SpotlightProvider({ children }: { children: ReactNode }) {
  const [spotlight, setSpot] = useState<SpotlightContent | null>(DEFAULT_SPOTLIGHT);

  useEffect(() => {
    void kvGet<SpotlightContent>("spotlight").then((row) => {
      if (row?.title) setSpot({ ...DEFAULT_SPOTLIGHT, ...row });
    });
  }, []);

  const update: SpotlightCtx["update"] = (patch) => {
    const next: SpotlightContent = { ...(spotlight ?? DEFAULT_SPOTLIGHT), ...patch, updatedAt: Date.now() };
    setSpot(next);
    void kvSet("spotlight", next);
  };

  return <SPContext.Provider value={{ spotlight, update }}>{children}</SPContext.Provider>;
}

export const useSpotlight = () => {
  const c = useContext(SPContext);
  if (!c) throw new Error("useSpotlight must be used within SpotlightProvider");
  return c;
};

/* ============================================================
   GROUP CART SESSIONS (server backed via KV rows)
   ============================================================ */

export type GroupCartMember = { id: string; name: string; joinedAt: number };
export type GroupItemOwner = { lineId: string; memberId: string; name: string; price: number; qty: number };
export type GroupCartSession = {
  id: string;
  hostId: string;
  restaurantId: string;
  restaurantName: string;
  members: GroupCartMember[];
  itemOwners: GroupItemOwner[];
  createdAt: number;
  closed?: boolean;
  locked?: boolean;
};

type GroupCtx = {
  sessions: Record<string, GroupCartSession>;
  createSession: (input: { hostId: string; hostName: string; restaurantId: string; restaurantName: string }) => GroupCartSession;
  joinSession: (id: string, member: { id: string; name: string }) => GroupCartSession | null;
  getSession: (id: string) => GroupCartSession | null;
  closeSession: (id: string) => void;
  lockSession: (id: string, locked: boolean) => void;
  removeMember: (id: string, memberId: string) => void;
  syncItems: (
    id: string,
    currentMemberId: string,
    items: Array<{ lineId: string; name: string; price: number; qty: number }>,
  ) => void;
  subtotalFor: (id: string, memberId: string) => number;
};

const GCContext = createContext<GroupCtx | null>(null);
const gcKey = (id: string) => `group_cart:${id}`;

export function GroupCartProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<Record<string, GroupCartSession>>({});

  const persist = (s: GroupCartSession) => {
    setSessions((p) => ({ ...p, [s.id]: s }));
    void kvSet(gcKey(s.id), s);
  };

  // Poll open sessions so every participant sees the same server state.
  useEffect(() => {
    const ids = Object.keys(sessions).filter((id) => !sessions[id]?.closed);
    if (!ids.length) return;
    const t = window.setInterval(() => {
      for (const id of ids) {
        void kvGet<GroupCartSession>(gcKey(id)).then((row) => {
          if (row?.id) setSessions((p) => ({ ...p, [id]: row }));
        });
      }
    }, 5000);
    return () => window.clearInterval(t);
  }, [sessions]);

  const createSession: GroupCtx["createSession"] = ({ hostId, hostName, restaurantId, restaurantName }) => {
    const id = `GRP${uid().toUpperCase()}`;
    const session: GroupCartSession = {
      id,
      hostId,
      restaurantId,
      restaurantName,
      members: [{ id: hostId, name: hostName, joinedAt: Date.now() }],
      itemOwners: [],
      createdAt: Date.now(),
    };
    persist(session);
    return session;
  };

  const joinSession: GroupCtx["joinSession"] = (id, member) => {
    const cur = sessions[id];
    if (!cur) {
      // Fetch from the server, then add the member.
      void kvGet<GroupCartSession>(gcKey(id)).then((row) => {
        if (!row?.id) return;
        if (row.closed || row.locked || row.members.some((m) => m.id === member.id)) {
          setSessions((p) => ({ ...p, [id]: row }));
          return;
        }
        persist({ ...row, members: [...row.members, { ...member, joinedAt: Date.now() }] });
      });
      return null;
    }
    if (cur.members.some((m) => m.id === member.id) || cur.locked || cur.closed) return cur;
    const next = { ...cur, members: [...cur.members, { ...member, joinedAt: Date.now() }] };
    persist(next);
    return next;
  };

  const getSession: GroupCtx["getSession"] = (id) => sessions[id] ?? null;

  const closeSession: GroupCtx["closeSession"] = (id) => {
    const cur = sessions[id];
    if (cur) persist({ ...cur, closed: true });
  };

  const lockSession: GroupCtx["lockSession"] = (id, locked) => {
    const cur = sessions[id];
    if (cur) persist({ ...cur, locked });
  };

  const removeMember: GroupCtx["removeMember"] = (id, memberId) => {
    const cur = sessions[id];
    if (!cur) return;
    persist({
      ...cur,
      members: cur.members.filter((m) => m.id !== memberId),
      itemOwners: cur.itemOwners.filter((o) => o.memberId !== memberId),
    });
  };

  const syncItems: GroupCtx["syncItems"] = (id, memberId, items) => {
    const cur = sessions[id];
    if (!cur) return;
    const owned = new Map(cur.itemOwners.map((o) => [o.lineId, o] as const));
    const nextOwners: GroupItemOwner[] = items.map((it) => ({
      lineId: it.lineId,
      memberId: owned.get(it.lineId)?.memberId ?? memberId,
      name: it.name,
      price: it.price,
      qty: it.qty,
    }));
    persist({ ...cur, itemOwners: nextOwners });
  };

  const subtotalFor: GroupCtx["subtotalFor"] = (id, memberId) => {
    const cur = sessions[id];
    if (!cur) return 0;
    return cur.itemOwners.filter((o) => o.memberId === memberId).reduce((s, o) => s + o.price * o.qty, 0);
  };

  const value = useMemo(
    () => ({
      sessions,
      createSession,
      joinSession,
      getSession,
      closeSession,
      lockSession,
      removeMember,
      syncItems,
      subtotalFor,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions],
  );

  return <GCContext.Provider value={value}>{children}</GCContext.Provider>;
}

export const useGroupCart = () => {
  const c = useContext(GCContext);
  if (!c) throw new Error("useGroupCart must be used within GroupCartProvider");
  return c;
};

/* ============================================================
   Combined provider
   ============================================================ */

export function ScoobixExtrasProviders({ children }: { children: ReactNode }) {
  return (
    <SpotlightProvider>
      <MealPlanProvider>
        <BulkProvider>
          <GroupCartProvider>{children}</GroupCartProvider>
        </BulkProvider>
      </MealPlanProvider>
    </SpotlightProvider>
  );
}
