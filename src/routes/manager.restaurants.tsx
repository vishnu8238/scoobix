import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Store, Phone, Mail, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/cravio/PageHeader";
import {
  useManager,
  useManagerRestaurants,
  onboardingStatus,
  ONBOARDING_LABEL,
  ONBOARDING_TONE,
  ONBOARDING_STATUSES,
  deleteManagedRestaurant,
} from "@/lib/manager-api";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/manager/restaurants")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · My restaurants" },
      { name: "description", content: "Restaurants assigned to you, with onboarding status and contacts." },
    ],
  }),
  component: ManagerRestaurants,
});

function ManagerRestaurants() {
  const { manager } = useManager();
  const { list, loading, refresh } = useManagerRestaurants(manager?.id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all");

  const filtered = list.filter((r) => {
    const s = onboardingStatus(r);
    if (filter !== "all" && s !== filter) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.rst_code, r.city, r.owner_name, r.contact_phone]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="My restaurants" subtitle={`${list.length} assigned`} back={false} />
      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, city, owner…"
            className="h-11 w-full rounded-2xl bg-secondary/50 pl-11 pr-4 text-sm outline-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary/40"
          />
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {["all", ...ONBOARDING_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-2 text-[11px] font-bold transition",
                filter === s ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-border",
              )}
            >
              {s === "all" ? "All" : ONBOARDING_LABEL[s as keyof typeof ONBOARDING_LABEL]}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {loading && <div className="h-24 animate-pulse rounded-3xl bg-muted/60" />}
          {!loading && filtered.length === 0 && (
            <div className="rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border/60">
              <p className="text-sm font-semibold">Nothing here yet</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Restaurants you onboard or that admin assigns to you appear here.
              </p>
            </div>
          )}
          {filtered.map((r) => {
            const s = onboardingStatus(r);
            return (
              <div key={r.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                    <Store className="h-5 w-5" strokeWidth={2.4} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.name || "Untitled restaurant"}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {r.rst_code || "ID pending"}
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${ONBOARDING_TONE[s]}`}>
                    {ONBOARDING_LABEL[s]}
                  </span>
                </div>

                {(r.city || r.address) && (
                  <p className="mt-3 flex items-start gap-1.5 text-[12px] text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="line-clamp-2">{[r.address, r.city].filter(Boolean).join(", ")}</span>
                  </p>
                )}
                {r.rejection_reason && s === "rejected" && (
                  <p className="mt-2 rounded-2xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                    {r.rejection_reason}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.contact_phone && (
                    <a
                      href={`tel:${r.contact_phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold"
                    >
                      <Phone className="h-3.5 w-3.5" /> Call
                    </a>
                  )}
                  {(r.contact_email || r.owner_email) && (
                    <a
                      href={`mailto:${r.contact_email || r.owner_email}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[11px] font-bold"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-8 w-8 rounded-full text-rose-500 hover:bg-rose-50 hover:text-rose-600"
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (!window.confirm(`Are you sure you want to permanently delete "${r.name || "this restaurant"}"? This cannot be undone.`)) return;
                      const ok = await deleteManagedRestaurant(r.id);
                      if (ok) {
                        toast.success("Restaurant deleted");
                        void refresh();
                      } else {
                        toast.error("Could not delete restaurant");
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link
                    to="/manager/onboarding"
                    search={{ id: r.id }}
                    className="rounded-full bg-primary px-3.5 py-1.5 text-[11px] font-bold text-primary-foreground"
                  >
                    {s === "draft" || s === "document_pending" ? "Continue" : "Open"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
