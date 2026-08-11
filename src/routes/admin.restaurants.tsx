import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Star, Percent, Pencil, Save, X, Check, Ban, Search, Loader2, UserRound, Rocket, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatPrice } from "@/lib/format";
import { useCms } from "@/lib/cms-store";
import { listTable, patchRecord, deleteRecord } from "@/lib/insforge-crud";
import { setRestaurantApprovalStatus, setRestaurantCommission, updateRestaurantStatus, deleteRestaurantComplete } from "@/lib/insforge";
import { ensureRestaurantCode } from "@/lib/restaurant-id";
import type { RestaurantRow } from "@/lib/partner-store";
import { ChecklistList, ChecklistProgress, useGoLiveChecklist } from "@/components/cravio/GoLiveChecklist";
import { AdminKycPanel } from "@/components/cravio/KycPanel";
import { setGoLiveOverride, setRestaurantLive, setVerificationFlag, type ChecklistItem, type GoLiveRow } from "@/lib/go-live";

export const Route = createFileRoute("/admin/restaurants")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Restaurants" }] }),
  component: AdminRestaurants,
});

type OwnerRow = { id: string; name?: string | null; phone?: string | null; email?: string | null };

const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  approved: "Live",
  pending: "Pending",
  suspended: "Suspended",
  rejected: "Rejected",
};

function AdminRestaurants() {
  const [rows, setRows] = useState<RestaurantRow[]>([]);
  const [owners, setOwners] = useState<Record<string, OwnerRow>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [openDetail, setOpenDetail] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await listTable<RestaurantRow>("restaurants", { order: "created_at.desc", limit: 500 });
    setRows(list);
    const ownerIds = Array.from(new Set(list.map((r) => r.owner_id).filter(Boolean))) as string[];
    if (ownerIds.length) {
      const users = await listTable<OwnerRow>("users", { id: `in.(${ownerIds.join(",")})`, limit: 500 });
      setOwners(Object.fromEntries(users.map((u) => [u.id, u])));
    }
    setLoading(false);
    // Backfill permanent IDs for any row created before codes existed.
    const missing = list.filter((r) => !r.code);
    for (const r of missing) {
      const code = await ensureRestaurantCode(r);
      if (code) setRows((p) => p.map((x) => (x.id === r.id ? { ...x, code } : x)));
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const owner = r.owner_id ? owners[r.owner_id] : undefined;
      return [r.code, r.name, owner?.name, owner?.phone, owner?.email, r.manager_name]
        .some((v) => (v ?? "").toString().toLowerCase().includes(term));
    });
  }, [rows, owners, q]);

  const updateStatus = async (r: RestaurantRow, backend: "approved" | "rejected" | "suspended", label: string) => {
    await setRestaurantApprovalStatus(r.id, backend);
    setRows((p) => p.map((x) => (x.id === r.id ? { ...x, status: backend } : x)));
    toast.success(`${r.name} ${label}`);
  };

  const saveManager = async (id: string, patch: Partial<RestaurantRow>) => {
    await patchRecord("restaurants", id, patch as Record<string, unknown>);
    setRows((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    toast.success("Relationship manager updated");
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selection);
    if (!ids.length) return;

    setIsBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await deleteRestaurantComplete(id);
        if (res.ok) successCount++;
        else failCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) {
      toast.success(`${successCount} restaurant(s) deleted successfully`);
      await refresh();
      setSelection(new Set());
    }
    if (failCount > 0) {
      toast.error(`${failCount} restaurant(s) could not be deleted.`);
    }

    setIsBulkDeleting(false);
    setDeleteModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Restaurants</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Partner restaurants</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {selection.size > 0 && (
            <div className="flex items-center gap-3 rounded-2xl bg-primary/5 px-4 py-2 ring-1 ring-primary/20">
              <span className="text-sm font-bold text-primary">{selection.size} selected</span>
              <button 
                onClick={() => setDeleteModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-bold text-white shadow-soft transition active:scale-95"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Selected
              </button>
              <button 
                onClick={() => setSelection(new Set())}
                className="text-xs font-bold text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}
          <div className="flex min-w-[280px] items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/60">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search ID, name, owner or phone"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        {loading ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No restaurants match “{q}”.</p>
        ) : (
          <DataTable
            columns={["Restaurant ID", "Restaurant", "Owner", "Rating", "Commission %", "Manager", "Open", "Status", "Actions"]}
            selection={selection}
            onSelectionChange={setSelection}
            rows={filtered.map((r) => {
              const owner = r.owner_id ? owners[r.owner_id] : undefined;
              const status = STATUS_LABEL[(r.status ?? "").toLowerCase()] ?? (r.status ?? "Pending");
              return [
                <button key={r.id + "code"} onClick={() => setOpenDetail(openDetail === r.id ? null : r.id)} className="font-mono text-xs font-extrabold text-primary">{r.code ?? "—"}</button>,
                <div className="flex items-center gap-3" key={r.id + "name"}>
                  {r.logo_url ? <img src={r.logo_url} alt="" className="h-10 w-10 rounded-xl object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary text-xs font-extrabold">{(r.name ?? "?").slice(0, 2).toUpperCase()}</span>}
                  <span className="font-bold">{r.name}</span>
                </div>,
                <span key={r.id + "owner"} className="text-muted-foreground">{owner?.name ?? "Unassigned"}{owner?.phone ? ` · ${owner.phone}` : ""}</span>,
                <span key={r.id + "rating"} className="flex items-center gap-1 font-bold"><Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /> {(r.rating_value ?? 0).toFixed(1)}</span>,
                <CommissionCell key={r.id + "comm"} id={r.id} saved={r.commission ?? 15} />,
                <span key={r.id + "mgr"} className="text-muted-foreground">{r.manager_name ?? "—"}</span>,
                <OpenToggle key={r.id + "open"} id={r.id} />,
                <StatusBadge key={r.id + "status"} label={status} />,
                <div key={r.id + "act"} className="flex items-center gap-1.5">
                  <ActionButton tone="primary" icon={Check} label="Approve" onClick={() => void updateStatus(r, "approved", "approved")} />
                  <ActionButton tone="warn" icon={Ban} label="Suspend" onClick={() => void updateStatus(r, "suspended", "suspended")} />
                  <DeleteRestaurantDialog restaurant={r} onDeleted={refresh} />
                </div>,
              ];
            })}
          />
        )}
      </section>

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold">Delete {selection.size} restaurant{selection.size > 1 ? 's' : ''}?</DialogTitle>
            <DialogDescription className="text-sm py-2">
              This action will permanently delete the selected restaurants and their associated records (menu, categories, KYC).
              Historical orders will be preserved.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <button
              onClick={() => setDeleteModalOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
            >
              {isBulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete {selection.size} Restaurant{selection.size > 1 ? 's' : ''}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {openDetail && (() => {
        const r = rows.find((x) => x.id === openDetail);
        if (!r) return null;
        const owner = r.owner_id ? owners[r.owner_id] : undefined;
        return <RestaurantDetail key={r.id} restaurant={r} owner={owner} onClose={() => setOpenDetail(null)} onSaveManager={saveManager} />;
      })()}
    </div>
  );
}

function RestaurantDetail({
  restaurant, owner, onClose, onSaveManager,
}: {
  restaurant: RestaurantRow;
  owner?: OwnerRow;
  onClose: () => void;
  onSaveManager: (id: string, patch: Partial<RestaurantRow>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    manager_name: restaurant.manager_name ?? "",
    manager_phone: restaurant.manager_phone ?? "",
    manager_email: restaurant.manager_email ?? "",
    manager_avatar: restaurant.manager_avatar ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSaveManager(restaurant.id, form);
    setSaving(false);
  };

  return (
    <section className="space-y-5 rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-extrabold uppercase tracking-wider text-primary">{restaurant.code}</p>
          <h2 className="mt-1 font-display text-xl font-extrabold">{restaurant.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{restaurant.address ?? "No address"}</p>
          <p className="text-sm text-muted-foreground">Owner: {owner?.name ?? "Unassigned"}{owner?.phone ? ` · ${owner.phone}` : ""}{owner?.email ? ` · ${owner.email}` : ""}</p>
          <p className="text-sm text-muted-foreground">Commission {restaurant.commission ?? 0}% · Payout every {restaurant.payout_cycle_hours ?? 24}h · Pending {formatPrice(restaurant.pending_payout ?? 0)}</p>
        </div>
        <button onClick={onClose} className="rounded-xl bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">Close</button>
      </div>

      <AdminKycPanel restaurantId={restaurant.id} actor={{ role: "admin", name: "Scoobix admin" }} />

      <AdminGoLivePanel restaurant={restaurant as GoLiveRow} />


      <div className="rounded-2xl bg-muted/40 p-4">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><UserRound className="h-4 w-4 text-primary" /> Relationship manager</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {([
            ["manager_name", "Manager name"],
            ["manager_phone", "Manager phone"],
            ["manager_email", "Manager email"],
            ["manager_avatar", "Manager avatar URL"],
          ] as const).map(([key, label]) => (
            <input
              key={key}
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              placeholder={label}
              className="rounded-2xl bg-background px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:ring-primary/40"
            />
          ))}
        </div>
        <button onClick={save} disabled={saving} className="mt-3 flex items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition active:scale-95 disabled:opacity-60">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save manager
        </button>
      </div>
    </section>
  );
}

function OpenToggle({ id }: { id: string }) {
  const { closedRestaurants, toggleRestaurantClosed } = useCms();
  const closed = !!closedRestaurants[id];
  return (
    <button
      onClick={() => { void updateRestaurantStatus(id, { is_open: closed }); toggleRestaurantClosed(id); toast.success(closed ? "Restaurant marked open" : "Restaurant marked closed"); }}
      className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider transition active:scale-95 ${closed ? "bg-zinc-200 text-zinc-700" : "bg-primary-soft text-primary"}`}
    >
      {closed ? "Closed" : "Open"}
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, tone }: { icon: typeof Check; label: string; onClick: () => void; tone: "primary" | "warn" | "danger" }) {
  const cls = tone === "primary" ? "bg-primary-soft text-primary"
    : tone === "warn" ? "bg-amber-100 text-amber-700"
    : "bg-rose-100 text-rose-700";
  return (
    <button onClick={onClick} title={label} className={`grid h-7 w-7 place-items-center rounded-full transition active:scale-90 ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function CommissionCell({ id, saved: initial }: { id: string; saved: number }) {
  const { commissions, setCommission } = useCms();
  const [open, setOpen] = useState(false);
  const saved = commissions[id] ?? initial;
  const [value, setValue] = useState(String(saved));

  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const previewAmount = 1000;
  const earning = Math.round(previewAmount * (pct / 100));

  const handleSave = () => {
    void setRestaurantCommission(id, pct);
    setCommission(id, pct);
    setOpen(false);
    toast.success(`Commission updated to ${pct}%`);
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) setValue(String(saved));
    setOpen(isOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 text-sm transition active:scale-95">
          <span className="font-display font-bold">{saved}%</span>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-3 rounded-2xl border-border/60 bg-card p-4 shadow-soft ring-1 ring-border/60" align="center">
        <p className="font-display text-sm font-bold">Edit commission</p>
        <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 ring-1 ring-border/60 focus-within:bg-background focus-within:ring-primary/40">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-16 bg-transparent font-display text-lg font-extrabold outline-none tabular-nums"
          />
          <Percent className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="rounded-2xl bg-primary/10 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Order amount</span>
            <span className="font-bold">{formatPrice(previewAmount)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Commission ({pct}%)</span>
            <span className="font-bold">− {formatPrice(earning)}</span>
          </div>
          <div className="mt-2 border-t border-dashed border-border/60 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-primary">Platform earning</span>
              <span className="font-display font-extrabold text-primary">{formatPrice(earning)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-glow transition active:scale-95">
            <Save className="h-3.5 w-3.5" /> Save
          </button>
          <button onClick={() => setOpen(false)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-xs font-bold text-muted-foreground transition active:scale-95">
            <X className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AdminGoLivePanel({ restaurant }: { restaurant: GoLiveRow }) {
  const [row, setRow] = useState<GoLiveRow>(restaurant);
  const { items, percent, complete, eligible } = useGoLiveChecklist(row);
  const live = !!row.is_live;

  const toggleVerify = async (item: ChecklistItem) => {
    const field = item.key === "bank" ? "bank_verified" : "docs_verified";
    const next = !item.done;
    setRow((p) => ({ ...p, [field]: next }));
    await setVerificationFlag(row.id, field, next);
    toast.success(`${item.label} ${next ? "verified" : "unverified"}`);
  };

  const toggleOverride = async () => {
    const next = !row.go_live_override;
    setRow((p) => ({ ...p, go_live_override: next }));
    await setGoLiveOverride(row.id, next);
    toast.success(next ? "Admin override enabled" : "Admin override removed");
  };

  const toggleLive = async () => {
    const next = !live;
    if (next && !eligible) {
      toast.error("Checklist incomplete — complete it or enable admin override.");
      return;
    }
    setRow((p) => ({ ...p, is_live: next }));
    await setRestaurantLive(row.id, next);
    toast.success(next ? `${row.name} is now live` : `${row.name} taken offline`);
  };

  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-display text-sm font-bold"><Rocket className="h-4 w-4 text-primary" /> Go-live checklist</p>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${live ? "bg-emerald-100 text-emerald-700" : eligible ? "bg-primary-soft text-primary" : "bg-amber-100 text-amber-700"}`}>
          {live ? "Live" : eligible ? "Ready" : "Not live"}
        </span>
      </div>
      <div className="mt-3"><ChecklistProgress percent={percent} /></div>
      <div className="mt-3"><ChecklistList items={items} onToggleAdmin={toggleVerify} /></div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void toggleLive()}
          disabled={!live && !eligible}
          className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${live ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground shadow-glow"}`}
        >
          {live ? "Take offline" : "Set live"}
        </button>
        <button
          onClick={() => void toggleOverride()}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-bold transition active:scale-95 ${row.go_live_override ? "bg-amber-100 text-amber-700" : "bg-card text-muted-foreground ring-1 ring-border/60"}`}
        >
          <ShieldCheck className="h-4 w-4" /> {row.go_live_override ? "Override on" : "Override checklist"}
        </button>
        {!complete && !row.go_live_override && (
          <span className="text-[11px] text-muted-foreground">Restaurant stays hidden until 100% or override.</span>
        )}
      </div>
    </div>
  );
}

function DeleteRestaurantDialog({ restaurant, onDeleted }: { restaurant: RestaurantRow; onDeleted: () => void }) {
  const [confirmName, setConfirmName] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    if (confirmName !== restaurant.name) {
      toast.error("Restaurant name does not match.");
      return;
    }

    setIsDeleting(true);
    try {
      const res = await deleteRestaurantComplete(restaurant.id);
      if (res.ok) {
        toast.success(`${restaurant.name} deleted successfully`);
        onDeleted();
        setOpen(false);
      } else {
        throw new Error("Failed to delete restaurant");
      }
    } catch (err) {
      toast.error("Failed to delete restaurant. Try archiving instead.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button title="Delete" className="grid h-7 w-7 place-items-center rounded-full bg-rose-100 text-rose-700 transition active:scale-90">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-bold">Delete {restaurant.name}?</DialogTitle>
          <DialogDescription className="text-sm py-2">
            This action is destructive. Menu items, categories, and documents will be permanently removed.
            Historical orders and financial records will be preserved.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm font-medium">Type <span className="font-bold text-foreground">"{restaurant.name}"</span> to confirm:</p>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            className="w-full rounded-xl border-border/60 bg-muted/30 px-3 py-2.5 text-sm outline-none ring-1 ring-border/60 focus:ring-rose-500/40"
            placeholder="Restaurant name"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            onClick={() => setOpen(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={confirmName !== restaurant.name || isDeleting}
            className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition active:scale-95 disabled:opacity-50"
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete permanently
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
