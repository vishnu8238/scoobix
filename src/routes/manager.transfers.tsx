import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/format";
import { useManager, useManagerRestaurants, listManagers, type MerchantManager } from "@/lib/manager-api";
import {
  listTransfers,
  requestOwnershipTransfer,
  transferStatus,
  TRANSFER_LABEL,
  TRANSFER_TONE,
  type TransferRow,
} from "@/lib/transfers-api";

export const Route = createFileRoute("/manager/transfers")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · Ownership transfers" },
      { name: "description", content: "Request and track restaurant ownership transfers." },
    ],
  }),
  component: ManagerTransfers,
});

function ManagerTransfers() {
  const { manager } = useManager();
  const { list } = useManagerRestaurants(manager?.id);
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [managers, setManagers] = useState<MerchantManager[]>([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [toManagerId, setToManagerId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!manager?.id) return;
    setRows(await listTransfers({ managerId: manager.id, limit: 200 }));
  }, [manager?.id]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => { void listManagers().then(setManagers); }, []);

  const others = useMemo(() => managers.filter((m) => m.id !== manager?.id), [managers, manager?.id]);

  const send = async () => {
    const restaurant = list.find((r) => r.id === restaurantId);
    const to = others.find((m) => m.id === toManagerId) ?? null;
    if (!restaurant) { toast.error("Pick a restaurant"); return; }
    if (!reason.trim()) { toast.error("Add a reason for the transfer"); return; }
    setBusy(true);
    const created = await requestOwnershipTransfer({
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        rst_code: restaurant.rst_code,
        manager_id: restaurant.manager_id,
        manager_name: manager?.name ?? null,
      },
      toManager: to ? { id: to.id, name: to.name ?? null } : null,
      requestedBy: manager?.id ?? null,
      requestedByName: manager?.name ?? null,
      reason: reason.trim(),
    });
    setBusy(false);
    if (!created) { toast.error("Could not send the request"); return; }
    setReason(""); setRestaurantId(""); setToManagerId("");
    toast.success("Transfer request sent to admin");
    await refresh();
  };

  return (
    <div className="mx-auto max-w-[520px] pb-8">
      <PageHeader title="Ownership transfers" subtitle="Request a hand-over and track admin decisions" />
      <div className="space-y-4 px-5 pt-4">
        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="font-display text-base font-extrabold">New request</p>
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="h-11 w-full rounded-2xl bg-secondary/50 px-3 text-sm font-medium outline-none"
          >
            <option value="">Select restaurant…</option>
            {list.map((r) => (
              <option key={r.id} value={r.id}>{r.name} · {r.rst_code ?? "—"}</option>
            ))}
          </select>
          <select
            value={toManagerId}
            onChange={(e) => setToManagerId(e.target.value)}
            className="h-11 w-full rounded-2xl bg-secondary/50 px-3 text-sm font-medium outline-none"
          >
            <option value="">Transfer to manager…</option>
            {others.map((m) => (
              <option key={m.id} value={m.id}>{m.name} {m.region ? `· ${m.region}` : ""}</option>
            ))}
          </select>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why should this restaurant move?"
            className="min-h-[76px] rounded-2xl bg-secondary/50 text-[13px]"
          />
          <Button
            className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow"
            disabled={busy}
            onClick={() => void send()}
          >
            <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Request transfer
          </Button>
        </div>

        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Transfer history</p>
          {rows.length === 0 && (
            <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
              No transfer requests yet.
            </p>
          )}
          {rows.map((t) => {
            const s = transferStatus(t);
            return (
              <div key={t.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-bold">{t.restaurant_name ?? "Restaurant"}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", TRANSFER_TONE[s])}>
                    {TRANSFER_LABEL[s]}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t.from_manager_name ?? "Unassigned"} → {t.to_manager_name ?? "—"} ·{" "}
                  {t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}
                </p>
                {t.reason && <p className="mt-1 text-[12px] italic text-muted-foreground">“{t.reason}”</p>}
                {t.admin_remarks && <p className="mt-1 text-[12px] text-muted-foreground">Admin: {t.admin_remarks}</p>}
              </div>
            );
          })}
        </div>

        <Link
          to="/manager/restaurants"
          className="flex items-center gap-2 rounded-3xl bg-card p-4 text-sm font-semibold shadow-soft ring-1 ring-border/60"
        >
          My restaurants <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
