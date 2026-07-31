import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { GitBranch, MapPin, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/format";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { createRecord, listTable } from "@/lib/insforge-crud";
import {
  listBranches,
  nextBranchCode,
  logDuplicateCheck,
  type DuplicateCandidate,
} from "@/lib/duplicate-api";
import { DuplicateDialog, useDuplicateCheck, type DuplicateChoice } from "@/components/cravio/DuplicateCheck";
import { listTransfers, transferStatus, TRANSFER_LABEL, TRANSFER_TONE, type TransferRow } from "@/lib/transfers-api";

export const Route = createFileRoute("/partner/branches")({
  head: () => ({
    meta: [
      { title: "Scoobix Partner · Branches & ownership" },
      { name: "description", content: "Add outlets, review duplicate checks and track ownership transfers." },
    ],
  }),
  component: PartnerBranches,
});

type BranchRow = {
  id: string;
  name?: string | null;
  rst_code?: string | null;
  branch_code?: string | null;
  branch_name?: string | null;
  address?: string | null;
  status?: string | null;
  onboarding_status?: string | null;
  delivery_radius?: number | null;
};

function PartnerBranches() {
  const { restaurant, loading } = usePartnerRestaurant();
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [form, setForm] = useState({ branch_name: "", address: "", city: "", pincode: "", phone: "", radius: "5" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const dup = useDuplicateCheck();

  const parentId = (restaurant as { parent_restaurant_id?: string | null } | null)?.parent_restaurant_id
    ?? restaurant?.id
    ?? "";

  const refresh = useCallback(async () => {
    if (!parentId) return;
    const [b, t] = await Promise.all([
      listBranches(parentId),
      restaurant?.id ? listTransfers({ restaurantId: restaurant.id, limit: 50 }) : Promise.resolve([]),
    ]);
    setBranches(b as BranchRow[]);
    setTransfers(t);
  }, [parentId, restaurant?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  const candidate: DuplicateCandidate = {
    name: `${restaurant?.name ?? ""} ${form.branch_name}`.trim(),
    phone: form.phone,
    address: [form.address, form.city].filter(Boolean).join(", "),
    city: form.city,
  };

  const createBranch = async (flag?: string) => {
    if (!restaurant?.id) return;
    setBusy(true);
    const parent = { id: parentId, rst_code: (restaurant as { rst_code?: string | null }).rst_code ?? null };
    const branchCode = await nextBranchCode(parent);
    const created = await createRecord("restaurants", {
      name: `${restaurant.name} — ${form.branch_name || form.city || "Branch"}`,
      branch_name: form.branch_name || form.city || "Branch",
      branch_code: branchCode,
      is_branch: true,
      parent_restaurant_id: parentId,
      owner_id: (restaurant as { owner_id?: string | null }).owner_id ?? null,
      owner_name: (restaurant as { owner_name?: string | null }).owner_name ?? null,
      owner_email: (restaurant as { owner_email?: string | null }).owner_email ?? null,
      contact_phone: form.phone || null,
      address: form.address || null,
      city: form.city || null,
      pincode: form.pincode || null,
      delivery_radius: Number(form.radius) || 5,
      manager_id: (restaurant as { manager_id?: string | null }).manager_id ?? null,
      status: "pending",
      onboarding_status: "submitted",
      duplicate_flag: flag ?? null,
      submitted_at: new Date().toISOString(),
    });
    setBusy(false);
    if (!created) { toast.error("Could not create the branch"); return; }
    setForm({ branch_name: "", address: "", city: "", pincode: "", phone: "", radius: "5" });
    toast.success(`Branch ${branchCode} submitted for approval`);
    await refresh();
  };

  const submit = async () => {
    if (!restaurant?.id) return;
    if (!form.branch_name.trim() && !form.city.trim()) {
      toast.error("Give the outlet a name or city");
      return;
    }
    setBusy(true);
    const res = await dup.run(candidate);
    setBusy(false);
    await logDuplicateCheck({
      candidate,
      result: res,
      restaurantId: restaurant.id,
      attemptedByName: (restaurant as { owner_name?: string | null }).owner_name ?? restaurant.name,
      attemptedByRole: "restaurant",
      sourceApp: "partner",
      action: "branch_create",
      decision: res.level === "none" ? "clear" : "pending",
    });
    if (res.level === "none") { await createBranch(); return; }
    setOpen(true);
  };

  const resolve = async (choice: DuplicateChoice) => {
    const res = dup.result;
    if (!res || !restaurant?.id) return;
    const log = (action: string, note?: string, decision?: string) =>
      logDuplicateCheck({
        candidate, result: res, restaurantId: restaurant.id,
        attemptedByName: restaurant.name, attemptedByRole: "restaurant", sourceApp: "partner",
        action, justification: note, decision,
      });
    if (choice.kind === "cancel") { await log("cancelled", undefined, "cancelled_by_owner"); setOpen(false); return; }
    if (choice.kind === "report") { await log("reported", choice.reason, "pending"); setOpen(false); toast.success("Reported to admin"); return; }
    if (choice.kind === "transfer") { await log("transfer_requested", choice.reason, "pending"); setOpen(false); toast.success("Sent to admin for review"); return; }
    await log(choice.kind === "branch" ? "continued_as_branch" : "continued",
      choice.kind === "branch" ? choice.justification : choice.justification, "pending");
    setOpen(false);
    await createBranch("branch_pending");
  };

  if (loading) {
    return <div className="mx-auto max-w-[520px] px-5 py-10"><div className="h-40 animate-pulse rounded-3xl bg-muted/60" /></div>;
  }

  return (
    <div className="mx-auto max-w-[520px] pb-8">
      <PageHeader title="Branches & ownership" subtitle={restaurant?.name ?? "Your restaurant"} />
      <div className="space-y-4 px-5 pt-4">
        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Outlets</p>
          {branches.length === 0 && (
            <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
              No extra outlets yet. Each branch keeps its own address, menu, delivery radius and earnings.
            </p>
          )}
          {branches.map((b) => (
            <div key={b.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                <p className="min-w-0 flex-1 truncate text-sm font-bold">{b.branch_name || b.name}</p>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {b.onboarding_status ?? b.status ?? "pending"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {b.branch_code ?? b.rst_code ?? "—"} · {b.address ?? "Address pending"} · {b.delivery_radius ?? 5} km radius
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="font-display text-base font-extrabold">Add a branch</p>
          <p className="text-[12px] text-muted-foreground">
            Scoobix runs a duplicate check first — legitimate branches are never blocked.
          </p>
          {([
            ["branch_name", "Outlet name", "Indiranagar"],
            ["address", "Street address", "100 Feet Road"],
            ["city", "City", "Bengaluru"],
            ["pincode", "Pincode", "560038"],
            ["phone", "Outlet phone", "+91 98xxxxxx01"],
            ["radius", "Delivery radius (km)", "5"],
          ] as const).map(([k, label, ph]) => (
            <div key={k} className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
              <Input
                value={form[k]}
                onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                placeholder={ph}
                className="h-11 rounded-2xl bg-secondary/50"
              />
            </div>
          ))}
          <Button
            className="h-12 w-full rounded-full gradient-primary text-sm font-bold text-primary-foreground shadow-glow"
            disabled={busy}
            onClick={() => void submit()}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Submit branch
          </Button>
        </div>

        <div className="space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Ownership transfers</p>
          {transfers.length === 0 ? (
            <p className="rounded-3xl bg-card p-5 text-center text-sm text-muted-foreground shadow-soft ring-1 ring-border/60">
              No transfer activity on this restaurant.
            </p>
          ) : (
            transfers.map((t) => {
              const s = transferStatus(t);
              return (
                <div key={t.id} className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">
                      {t.from_manager_name ?? "Unassigned"} → {t.to_manager_name ?? "—"}
                    </p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", TRANSFER_TONE[s])}>
                      {TRANSFER_LABEL[s]}
                    </span>
                  </div>
                  {t.admin_remarks && <p className="mt-1 text-[12px] text-muted-foreground">Admin: {t.admin_remarks}</p>}
                </div>
              );
            })
          )}
        </div>
      </div>

      <DuplicateDialog open={open} onOpenChange={setOpen} result={dup.result} onResolve={resolve} />
    </div>
  );
}
