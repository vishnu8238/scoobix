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

export const Route = createFileRoute("/admin/access")({
  head: () => ({ meta: [{ title: "Scoobix Admin · Access Management" }] }),
  component: AccessManagementPage,
});

const PORTAL_LABELS: Record<PortalType, string> = {
  partner: "Restaurant / Merchant",
  rider: "Rider",
  manager: "Manager",
  logistics: "Logistics",
};

function AccessManagementPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<PortalAccessRow[]>([]);
  const [search, setSearch] = useState("");
  const [portalFilter, setPortalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<PortalAccessRow | null>(null);
  const [busy, setBusy] = useState(false);

  // Form states
  const [formEmail, setFormEmail] = useState("");
  const [formPortal, setFormPortal] = useState<PortalType>("partner");
  const [formStatus, setFormStatus] = useState<PortalStatus>("active");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPortalAccess();
      setRecords(data);
    } catch (err: any) {
      console.error("[ACCESS_LOAD_ERROR]", err);
      toast.error(`Failed to load access records: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = !search || 
        r.email.toLowerCase().includes(search.toLowerCase()) ||
        r.email_normalized.includes(search.toLowerCase());
      const matchesPortal = portalFilter === "all" || r.portal === portalFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesPortal && matchesStatus;
    });
  }, [records, search, portalFilter, statusFilter]);

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
        status: formStatus,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
      });

      if (res) {
        toast.success("Access added successfully");
        setIsAddOpen(false);
        setFormEmail("");
        load();
      }
    } catch (err: any) {
      if (err.message?.includes("unique")) {
        toast.error("This email already has access to this portal");
      } else {
        toast.error(err.message || "Failed to add access");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!currentRecord) return;
    
    setBusy(true);
    try {
      await updatePortalAccess(currentRecord.id, { status: formStatus }, {
        email: currentRecord.email,
        portal: currentRecord.portal,
        previousStatus: currentRecord.status,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
      });
      toast.success("Access updated successfully");
      setIsEditOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update access");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (record: PortalAccessRow) => {
    if (!confirm(`Are you sure you want to remove access for ${record.email} to ${PORTAL_LABELS[record.portal]}?`)) return;
    
    try {
      await removePortalAccess(record.id, {
        email: record.email,
        portal: record.portal,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
      });
      toast.success("Access removed");
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove access");
    }
  };

  const toggleStatus = async (record: PortalAccessRow) => {
    const nextStatus: PortalStatus = record.status === "active" ? "disabled" : "active";
    try {
      await updatePortalAccess(record.id, { status: nextStatus }, {
        email: record.email,
        portal: record.portal,
        previousStatus: record.status,
        actorId: user?.id,
        actorName: user?.name,
        actorRole: user?.role,
      });
      toast.success(`Access ${nextStatus === "active" ? "enabled" : "disabled"}`);
      load();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Security</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Access Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage privileged portal access for Scoobix staff and partners.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => load()} className="rounded-2xl h-11 bg-card shadow-soft ring-1 ring-border/60">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
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
          <div className="flex gap-3">
            <Select value={portalFilter} onValueChange={setPortalFilter}>
              <SelectTrigger className="w-[180px] h-11 rounded-2xl shadow-soft">
                <Layout className="h-4 w-4 mr-2 text-muted-foreground" />
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
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-11 rounded-2xl shadow-soft">
                <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading && records.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Loading access records...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed border-border/40 rounded-3xl">
            <Search className="h-10 w-10 mb-4 opacity-20" />
            <p className="font-medium text-foreground">No records found</p>
            <p className="text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <DataTable
            columns={["Email", "Portal", "Status", "Last Login", "Added By", "Created", "Actions"]}
            rows={filteredRecords.map(r => {
              const emailPrefix = r.email.split("@")[0];
              const initials = (emailPrefix[0] + (emailPrefix[1] || "")).toUpperCase();
              
              return [
                <div key={`email-${r.id}`} className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                    {initials}
                  </div>
                  <span className="font-bold">{r.email}</span>
                </div>,
                <span key={`portal-${r.id}`} className="font-medium text-muted-foreground">{PORTAL_LABELS[r.portal]}</span>,
                <StatusBadge key={`status-${r.id}`} label={r.status === "active" ? "Active" : "Suspended"} />,
                <span key={`login-${r.id}`} className="text-xs text-muted-foreground">
                  {r.last_login_at ? new Date(r.last_login_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : "Never"}
                </span>,
                <span key={`actor-${r.id}`} className="text-xs text-muted-foreground">{r.created_by ? "Admin" : "System"}</span>,
                <span key={`date-${r.id}`} className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>,
                <div key={`actions-${r.id}`} className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" 
                    onClick={() => {
                      setCurrentRecord(r);
                      setFormStatus(r.status);
                      setIsEditOpen(true);
                    }}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" 
                    className={`h-8 w-8 rounded-lg ${r.status === "active" ? "text-amber-600" : "text-emerald-600"}`}
                    onClick={() => toggleStatus(r)}>
                    {r.status === "active" ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive"
                    onClick={() => handleRemove(r)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ];
            })}
          />
        )}
      </section>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="rounded-3xl border-none p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">Add Portal Access</DialogTitle>
            <DialogDescription>
              Grant access to a privileged Scoobix portal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Email Address</Label>
              <Input
                id="email"
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
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Initial Status</Label>
              <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                <SelectTrigger className="h-11 rounded-2xl shadow-soft">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} className="rounded-2xl">Cancel</Button>
            <Button onClick={handleAdd} disabled={busy} className="rounded-2xl shadow-glow min-w-[120px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="rounded-3xl border-none p-6 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl font-extrabold">Edit Access</DialogTitle>
            <DialogDescription>
              Modify status for {currentRecord?.email}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 rounded-2xl bg-muted/30 border border-border/40">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Portal</p>
              <p className="font-bold text-foreground">{currentRecord && PORTAL_LABELS[currentRecord.portal]}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Access Status</Label>
              <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                <SelectTrigger className="h-11 rounded-2xl shadow-soft">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="disabled">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setIsEditOpen(false)} className="rounded-2xl">Cancel</Button>
            <Button onClick={handleUpdate} disabled={busy} className="rounded-2xl shadow-glow min-w-[120px]">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
