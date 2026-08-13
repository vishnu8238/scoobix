import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  ShieldCheck, Search, Plus, Filter, Loader2, MoreHorizontal, 
  Mail, Layout, CheckCircle2, XCircle, Trash2, Edit2, AlertCircle,
  RefreshCw
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { listPortalAccess, createPortalAccess, updatePortalAccess, removePortalAccess } from "@/lib/access-api";
import { PortalAccessRow, PortalType, PortalStatus } from "@/lib/portal-authorization";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/logistics/access")({
  head: () => ({ meta: [{ title: "Scoobix Logistics · Access Management" }] }),
  component: LogisticsAccess,
});

const PORTAL_LABELS: Record<PortalType, string> = {
  partner: "Restaurant / Merchant",
  rider: "Rider",
  manager: "Manager",
  logistics: "Logistics",
};

function LogisticsAccess() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PortalAccessRow[]>([]);
  const [search, setSearch] = useState("");
  const [portalFilter, setPortalFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [formPortal, setFormPortal] = useState<PortalType>("partner");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPortalAccess();
      setRecords(data);
    } catch (err: any) {
      toast.error(`Failed to load access records`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = !search || r.email.toLowerCase().includes(search.toLowerCase());
      const matchesPortal = portalFilter === "all" || r.portal === portalFilter;
      return matchesSearch && matchesPortal;
    });
  }, [records, search, portalFilter]);

  const handleAdd = async () => {
    if (!formEmail || !formEmail.includes("@")) {
      toast.error("Please enter a valid email");
      return;
    }

    setBusy(true);
    try {
      const res = await createPortalAccess({
        email: formEmail,
        portal: formPortal,
        status: "active",
        actorId: user?.id,
        actorName: user?.name,
        actorRole: "logistics",
      });

      if (res) {
        toast.success("Access added successfully");
        setIsAddOpen(false);
        setFormEmail("");
        load();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add access");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (record: PortalAccessRow) => {
    if (!confirm(`Remove access for ${record.email}?`)) return;
    try {
      await removePortalAccess(record.id, {
        email: record.email,
        portal: record.portal,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: "logistics",
      });
      toast.success("Access removed");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove access");
    }
  };

  return (
    <div className="space-y-8 text-left">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Access Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage portal access for staff and partners.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsAddOpen(true)} className="rounded-2xl h-11 shadow-glow">
            <Plus className="h-4 w-4 mr-2" /> Add Portal Access
          </Button>
        </div>
      </header>

      <section className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[300px]">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 rounded-2xl pl-11 shadow-soft"
            />
          </div>
          <Select value={portalFilter} onValueChange={setPortalFilter}>
            <SelectTrigger className="w-[180px] h-11 rounded-2xl shadow-soft">
              <SelectValue placeholder="All Portals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Portals</SelectItem>
              <SelectItem value="partner">Restaurant</SelectItem>
              <SelectItem value="rider">Rider</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="logistics">Logistics</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DataTable
          columns={["Email", "Portal", "Status", "Last Login", "Created", "Actions"]}
          rows={filteredRecords.map(r => [
            <span key={`email-${r.id}`} className="font-bold">{r.email}</span>,
            <span key={`portal-${r.id}`} className="font-medium text-muted-foreground">{PORTAL_LABELS[r.portal]}</span>,
            <StatusBadge key={`status-${r.id}`} label={r.status} />,
            <span key={`login-${r.id}`} className="text-xs text-muted-foreground">{r.last_login_at ? new Date(r.last_login_at).toLocaleDateString() : "Never"}</span>,
            <span key={`date-${r.id}`} className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>,
            <div key={`actions-${r.id}`} className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive" onClick={() => handleRemove(r)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ])}
        />
      </section>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-3xl border-none p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">Add Portal Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className="h-11 rounded-2xl shadow-soft"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target Portal</Label>
              <Select value={formPortal} onValueChange={(v: any) => setFormPortal(v)}>
                <SelectTrigger className="h-11 rounded-2xl shadow-soft">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="partner">Restaurant / Merchant</SelectItem>
                  <SelectItem value="rider">Rider</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="logistics">Logistics</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAdd} disabled={busy} className="rounded-2xl shadow-glow min-w-[120px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
