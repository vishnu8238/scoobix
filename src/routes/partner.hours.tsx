import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { kvGet, kvSet } from "@/lib/kv-store";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/hours")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Opening hours" }] }),
  component: HoursPage,
});

type HourRow = { day: string; open: string; close: string; enabled: boolean };

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_ROWS: HourRow[] = DAYS.map((day) => ({ day, open: "10:00", close: "23:00", enabled: true }));

function HoursPage() {
  const { restaurantId } = usePartnerRestaurant();
  const key = `opening_hours:${restaurantId ?? "unassigned"}`;
  const [rows, setRows] = useState<HourRow[]>(DEFAULT_ROWS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void kvGet<HourRow[]>(key).then((v) => {
      if (cancelled) return;
      if (Array.isArray(v) && v.length === 7) setRows(v);
    });
    return () => { cancelled = true; };
  }, [key]);

  const update = (i: number, patch: Partial<HourRow>) =>
    setRows((p) => p.map((r, idx) => (i === idx ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    try {
      await kvSet(key, rows);
      toast.success("Opening hours saved");
    } catch {
      toast.error("Could not save opening hours");
    }
    setSaving(false);
  };


  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Opening hours" subtitle="Set when you accept orders" />

      <div className="mx-4 mt-4 overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
        {rows.map((r, i) => (
          <div key={r.day} className="flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-0">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="w-24 text-sm font-bold">{r.day}</div>
            <Input value={r.open}  onChange={(e) => update(i, { open: e.target.value })}  disabled={!r.enabled} className="h-9 w-24 rounded-xl bg-secondary/60 text-center font-mono text-sm" />
            <span className="text-muted-foreground">—</span>
            <Input value={r.close} onChange={(e) => update(i, { close: e.target.value })} disabled={!r.enabled} className="h-9 w-24 rounded-xl bg-secondary/60 text-center font-mono text-sm" />
            <div className="ml-auto"><Switch checked={r.enabled} onCheckedChange={(v) => update(i, { enabled: v })} /></div>
          </div>
        ))}
      </div>

      <div className="px-4 pt-6">
        <Button onClick={save} disabled={saving} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">{saving ? "Saving…" : "Save schedule"}</Button>
      </div>
    </div>
  );
}
