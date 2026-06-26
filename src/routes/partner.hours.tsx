import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Clock } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { openingHours } from "@/lib/mock-extras";
import { toast } from "sonner";

export const Route = createFileRoute("/partner/hours")({
  head: () => ({ meta: [{ title: "Cravio Partner · Opening hours" }] }),
  component: HoursPage,
});

function HoursPage() {
  const [rows, setRows] = useState(openingHours);

  const update = (i: number, patch: Partial<typeof rows[0]>) =>
    setRows((p) => p.map((r, idx) => (i === idx ? { ...r, ...patch } : r)));

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
        <Button onClick={() => toast.success("Opening hours saved")} className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow">Save schedule</Button>
      </div>
    </div>
  );
}
