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

export const Route = createFileRoute("/logistics/verification")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Verification" }] }),
  component: LogisticsVerification,
});

type Subject = { id: string; title: string; subtitle: string; status: KycStatus; percent: number };

function LogisticsVerification() {
  const { user } = useAuth();
  const [tab, setTab] = useState<VerifySubject>("restaurant");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const version = useTableVersion(["restaurant_kyc", "restaurants", "drivers", "merchant_managers"]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const base: Subject[] = [];
      if (tab === "restaurant") {
        const rows = await listTable<{ id: string; name?: string; code?: string }>("restaurants", { limit: 50 });
        base.push(...rows.map(r => ({ id: r.id, title: r.name || "Restaurant", subtitle: r.code || "RST", status: "pending" as KycStatus, percent: 0 })));
      } else if (tab === "rider") {
        const rows = await listTable<{ id: string; vehicle_number?: string; verification_status?: string }>("drivers", { limit: 50 });
        base.push(...rows.map(r => ({ id: r.id, title: r.vehicle_number || "Rider", subtitle: r.id.slice(0,8), status: normalizeStatus(r.verification_status), percent: 0 })));
      }
      
      const withState = await Promise.all(base.map(async (s) => {
        const sum = summarize(tab, await fetchDocs(tab, s.id));
        return { ...s, status: sum.complete ? "verified" : sum.blocked ? "reupload" : sum.underReview ? "under_review" : "pending", percent: sum.percent } as Subject;
      }));
      setSubjects(withState);
      setLoading(false);
    })();
  }, [tab, version]);

  return (
    <div className="space-y-6 text-left">
      <header>
        <h1 className="flex items-center gap-2 font-display text-2xl font-extrabold"><ShieldCheck className="h-6 w-6 text-primary" /> Verification center</h1>
      </header>

      <div className="flex gap-2">
        <button onClick={() => setTab("restaurant")} className={cn("px-4 py-2 rounded-2xl text-sm font-bold transition", tab === "restaurant" ? "bg-primary text-primary-foreground" : "bg-card")}>Restaurants</button>
        <button onClick={() => setTab("rider")} className={cn("px-4 py-2 rounded-2xl text-sm font-bold transition", tab === "rider" ? "bg-primary text-primary-foreground" : "bg-card")}>Riders</button>
      </div>

      {loading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div> : (
        <ul className="space-y-3">
          {subjects.map(s => (
            <li key={s.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <button onClick={() => setSelected(selected === s.id ? null : s.id)} className="flex w-full items-center justify-between">
                <div><p className="font-bold">{s.title}</p><p className="text-[10px] text-muted-foreground">{s.subtitle}</p></div>
                <div className="flex items-center gap-2"><span className="text-xs font-bold">{s.percent}%</span><StatusPill status={s.status} /></div>
              </button>
              {selected === s.id && <div className="mt-4"><VerificationReviewPanel subject={tab} subjectId={s.id} actor={{ id: user?.id, name: user?.name || "Logistics", role: "logistics" }} /></div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
