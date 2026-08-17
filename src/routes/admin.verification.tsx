import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, Store, Bike, Building2 } from "lucide-react";
import { listTable } from "@/lib/insforge-crud";
import { useTableVersion } from "@/lib/realtime-hooks";
import { VerificationReviewPanel, StatusPill } from "@/components/cravio/VerificationPanel";
import {
  fetchDocs,
  summarize,
  normalizeStatus,
  SUBJECT_LABEL,
  type KycStatus,
  type VerifySubject,
} from "@/lib/verification-api";
import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/format";

export const Route = createFileRoute("/admin/verification")({
  head: () => ({
    meta: [
      { title: "Verification centre · Scoobix Admin" },
      { name: "description", content: "Review and approve KYC documents for restaurants, riders and merchant managers." },
      { property: "og:title", content: "Verification centre · Scoobix Admin" },
      { property: "og:description", content: "One queue for every Scoobix KYC approval with a full audit trail." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminVerification,
});

type Subject = { id: string; title: string; subtitle: string; status: KycStatus; percent: number };

const TABS: { key: VerifySubject; label: string; icon: typeof Store }[] = [
  { key: "restaurant", label: "Restaurants", icon: Store },
  { key: "rider", label: "Riders", icon: Bike },
  { key: "manager", label: "Managers", icon: Building2 },
];

function AdminVerification() {
  const { user } = useAuth();
  const [tab, setTab] = useState<VerifySubject>("restaurant");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | KycStatus>("all");
  const version = useTableVersion(["restaurant_kyc", "restaurants", "drivers", "merchant_managers"]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setSelected(null);
      const base: Subject[] = [];

      if (tab === "restaurant") {
        const rows = await listTable<{ id: string; name?: string | null; code?: string | null; city?: string | null }>(
          "restaurants", { limit: 100 },
        );
        base.push(...rows.map((r) => ({
          id: r.id, title: r.name || "Unnamed restaurant", subtitle: r.code || r.city || "Restaurant",
          status: "pending" as KycStatus, percent: 0,
        })));
      } else if (tab === "rider") {
        const rows = await listTable<{ id: string; user_id?: string | null; vehicle_number?: string | null; verification_status?: string | null }>(
          "drivers", { limit: 100 },
        );
        base.push(...rows.map((r) => ({
          id: r.id, title: r.vehicle_number || `Rider ${r.id.slice(0, 6)}`,
          subtitle: r.user_id ? `User ${r.user_id.slice(0, 8)}` : "Rider",
          status: normalizeStatus(r.verification_status), percent: 0,
        })));
      } else {
        const rows = await listTable<{ id: string; name?: string | null; email?: string | null; region?: string | null; verification_status?: string | null }>(
          "merchant_managers", { limit: 100 },
        );
        base.push(...rows.map((r) => ({
          id: r.id, title: r.name || "Manager", subtitle: r.email || r.region || "Merchant manager",
          status: normalizeStatus(r.verification_status), percent: 0,
        })));
      }

      // Roll up each subject's document state so the queue is sortable.
      const withState = await Promise.all(base.map(async (s) => {
        const sum = summarize(tab, await fetchDocs(tab, s.id));
        const status: KycStatus = sum.complete
          ? "verified"
          : sum.blocked ? "reupload" : sum.underReview ? "under_review" : "pending";
        return { ...s, status, percent: sum.percent };
      }));

      if (cancelled) return;
      setSubjects(withState);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [tab, version]);

  const visible = useMemo(
    () => (filter === "all" ? subjects : subjects.filter((s) => s.status === filter)),
    [subjects, filter],
  );
  const pendingCount = subjects.filter((s) => s.status !== "verified").length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold">
          <ShieldCheck className="h-6 w-6 text-primary" /> Verification centre
        </h1>
        <p className="text-sm text-muted-foreground">
          Approve, reject or request re-uploads for every Scoobix role. Every action is logged.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold transition",
              tab === t.key ? "bg-primary text-primary-foreground shadow-glow" : "bg-card text-muted-foreground ring-1 ring-border/60",
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
        <span className="ml-auto text-[12px] font-bold text-muted-foreground">
          {pendingCount} {SUBJECT_LABEL[tab].toLowerCase()}s awaiting full approval
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "pending", "under_review", "reupload", "rejected", "verified"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider transition",
              filter === f ? "bg-foreground text-background" : "bg-card text-muted-foreground ring-1 ring-border/60",
            )}
          >
            {f === "all" ? "All" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : visible.length === 0 ? (
        <p className="rounded-3xl bg-card p-6 text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
          Nothing in this queue.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((s) => (
            <li key={s.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <button
                onClick={() => setSelected((p) => (p === s.id ? null : s.id))}
                className="flex w-full items-center justify-between gap-3 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{s.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-extrabold tabular-nums">{s.percent}%</span>
                  <StatusPill status={s.status} />
                </div>
              </button>

              {selected === s.id && (
                <div className="mt-4 animate-fade-down">
                  <VerificationReviewPanel
                    subject={tab}
                    subjectId={s.id}
                    actor={{ id: user?.id, name: user?.name ?? "Scoobix admin", role: "admin" }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
