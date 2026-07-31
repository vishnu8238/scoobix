import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone, Plus, Pause, Play, Copy, Archive, Pencil, BarChart3, RotateCcw, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPrice, cn } from "@/lib/format";
import { listTable } from "@/lib/insforge-crud";
import { useAuth } from "@/lib/auth-store";
import {
  CAMPAIGN_TYPES, CAMPAIGN_TYPE_LABEL, campaignAnalytics, effectiveStatus,
  listCampaigns, createCampaign, updateCampaign, archiveCampaign, restoreCampaign,
  duplicateCampaign, setCampaignStatus, listAuditLogs, impressionsByCampaign,
  type Campaign, type CampaignAudit, type CampaignStatus, type CampaignType,
  type CustomerSegment, type MembershipTier, type PaymentMethodKey,
} from "@/lib/campaigns-api";

export const Route = createFileRoute("/admin/campaigns")({
  head: () => ({
    meta: [
      { title: "Scoobix Admin · Marketing campaigns" },
      { name: "description", content: "Create, schedule and measure Scoobix promotional campaigns." },
    ],
  }),
  component: AdminCampaigns,
});

const SEGMENTS: CustomerSegment[] = ["all", "new", "returning", "loyal", "inactive", "birthday"];
const PAYMENTS: PaymentMethodKey[] = ["card", "upi", "wallet", "cash", "netbanking"];
const MEMBERSHIPS: MembershipTier[] = ["none", "plus", "pro"];

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-rose-100 text-rose-700",
  archived: "bg-zinc-200 text-zinc-600",
};

type Draft = Partial<Campaign>;

const emptyDraft: Draft = {
  name: "",
  type: "flat_discount",
  discount_type: "flat",
  discount_value: 50,
  min_order: 0,
  priority: 0,
  status: "draft",
  auto_apply: false,
  segments: ["all"],
  category_ids: [],
  zone_ids: [],
  restaurant_ids: [],
  payment_methods: [],
  memberships: [],
  config: {},
};

function toLocalInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminCampaigns() {
  const { user } = useAuth();
  const actor = { id: user?.id, email: user?.email };

  const [list, setList] = useState<Campaign[]>([]);
  const [impressions, setImpressions] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<CampaignAudit[]>([]);
  const [restaurants, setRestaurants] = useState<{ id: string; name?: string }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    const [rows, imp, audit] = await Promise.all([
      listCampaigns({ includeArchived: true }),
      impressionsByCampaign(),
      listAuditLogs(),
    ]);
    setList(rows);
    setImpressions(imp);
    setLogs(audit);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    void listTable<{ id: string; name?: string }>("restaurants", { limit: 200 }).then(setRestaurants);
    void listTable<{ id: string; name?: string }>("categories", { limit: 100 }).then(setCategories);
  }, [refresh]);

  const live = list.filter((c) => !c.archived);
  const totals = useMemo(() => {
    const a = live.map((c) => campaignAnalytics(c, impressions[c.id]));
    const redemptions = a.reduce((s, x) => s + x.redemptions, 0);
    const revenue = a.reduce((s, x) => s + x.revenue, 0);
    const discount = a.reduce((s, x) => s + x.discount, 0);
    const views = a.reduce((s, x) => s + x.impressions, 0);
    return {
      redemptions, revenue, discount,
      roi: discount > 0 ? +((revenue - discount) / discount).toFixed(2) : 0,
      conversion: views > 0 ? +((redemptions / views) * 100).toFixed(1) : 0,
    };
  }, [live, impressions]);

  const top = useMemo(
    () => [...live].sort((a, b) => (b.revenue_generated ?? 0) - (a.revenue_generated ?? 0)).slice(0, 5),
    [live],
  );

  const openNew = () => { setDraft({ ...emptyDraft }); setOpen(true); };
  const openEdit = (c: Campaign) => { setDraft({ ...c }); setOpen(true); };

  const save = async () => {
    if (!draft.name?.trim()) { toast.error("Campaign name is required"); return; }
    setSaving(true);
    const payload: Draft = {
      ...draft,
      name: draft.name.trim(),
      promo_code: draft.promo_code?.trim() ? draft.promo_code.trim().toUpperCase() : null,
      discount_value: Number(draft.discount_value ?? 0),
      min_order: Number(draft.min_order ?? 0),
      max_discount: draft.max_discount ? Number(draft.max_discount) : null,
      usage_per_user: draft.usage_per_user ? Number(draft.usage_per_user) : null,
      total_usage_limit: draft.total_usage_limit ? Number(draft.total_usage_limit) : null,
      priority: Number(draft.priority ?? 0),
    };
    if (draft.id) await updateCampaign(draft.id, payload, actor);
    else await createCampaign(payload, actor);
    setSaving(false);
    setOpen(false);
    toast.success(draft.id ? "Campaign updated" : "Campaign created");
    void refresh();
  };

  const act = async (fn: Promise<unknown>, msg: string) => {
    await fn;
    toast.success(msg);
    void refresh();
  };

  const toggleIn = <T,>(arr: T[] | null | undefined, v: T): T[] => {
    const cur = arr ?? [];
    return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, schedule, pause and measure every promotion — no developer needed.
          </p>
        </div>
        <Button onClick={openNew} className="rounded-full"><Plus className="mr-1.5 h-4 w-4" /> New campaign</Button>
      </header>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Redemptions" value={totals.redemptions} />
        <Kpi label="Revenue generated" value={formatPrice(totals.revenue)} />
        <Kpi label="Discount given" value={formatPrice(totals.discount)} accent />
        <Kpi label="ROI" value={`${totals.roi}×`} />
        <Kpi label="Conversion rate" value={`${totals.conversion}%`} />
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All campaigns</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            {loading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading campaigns…</p>
            ) : list.length === 0 ? (
              <div className="py-12 text-center">
                <Megaphone className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No campaigns yet. Create your first promotion.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Window</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((c) => {
                    const st = effectiveStatus(c);
                    return (
                      <TableRow key={c.id} className={cn(c.archived && "opacity-60")}>
                        <TableCell className="font-medium">
                          {c.name}
                          {c.sponsored && <Badge variant="secondary" className="ml-2">Sponsored</Badge>}
                          {c.auto_apply && <Badge variant="outline" className="ml-2">Auto</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{CAMPAIGN_TYPE_LABEL[c.type]}</TableCell>
                        <TableCell className="font-mono text-xs">{c.promo_code ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.start_at ? new Date(c.start_at).toLocaleDateString() : "—"} →{" "}
                          {c.end_at ? new Date(c.end_at).toLocaleDateString() : "—"}
                        </TableCell>
                        <TableCell>{c.priority ?? 0}</TableCell>
                        <TableCell>
                          {c.used_count ?? 0}
                          {c.total_usage_limit ? ` / ${c.total_usage_limit}` : ""}
                        </TableCell>
                        <TableCell>
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", STATUS_STYLE[st])}>{st}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Icon title="Edit" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Icon>
                            {st === "paused" || st === "draft" ? (
                              <Icon title="Activate" onClick={() => act(setCampaignStatus(c.id, "active", actor), "Campaign resumed")}><Play className="h-3.5 w-3.5" /></Icon>
                            ) : (
                              <Icon title="Pause" onClick={() => act(setCampaignStatus(c.id, "paused", actor), "Campaign paused")}><Pause className="h-3.5 w-3.5" /></Icon>
                            )}
                            <Icon title="Duplicate" onClick={() => act(duplicateCampaign(c, actor), "Campaign duplicated")}><Copy className="h-3.5 w-3.5" /></Icon>
                            {c.archived ? (
                              <Icon title="Restore" onClick={() => act(restoreCampaign(c.id, actor), "Campaign restored")}><RotateCcw className="h-3.5 w-3.5" /></Icon>
                            ) : (
                              <Icon title="Archive" onClick={() => act(archiveCampaign(c.id, actor), "Campaign archived")}><Archive className="h-3.5 w-3.5" /></Icon>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </section>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 space-y-6">
          <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
              <BarChart3 className="h-4 w-4" /> Top performing campaigns
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>ROI</TableHead>
                  <TableHead>Impressions</TableHead>
                  <TableHead>Conversion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top.map((c) => {
                  const a = campaignAnalytics(c, impressions[c.id]);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{a.redemptions}</TableCell>
                      <TableCell>{formatPrice(a.revenue)}</TableCell>
                      <TableCell>{formatPrice(a.discount)}</TableCell>
                      <TableCell>{a.roi}×</TableCell>
                      <TableCell>{a.impressions}</TableCell>
                      <TableCell>{a.conversionRate}%</TableCell>
                    </TableRow>
                  );
                })}
                {top.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">No data yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </section>
        </TabsContent>

        <TabsContent value="audit" className="mt-4">
          <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
            <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
              <History className="h-4 w-4" /> Audit trail
            </h2>
            <ul className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{l.action}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {l.actor_email ?? "system"} · {l.created_at ? new Date(l.created_at).toLocaleString() : ""}
                  </span>
                </li>
              ))}
              {logs.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No activity yet.</li>}
            </ul>
          </section>
        </TabsContent>
      </Tabs>

      {/* Editor */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{draft.id ? "Edit campaign" : "New campaign"}</DialogTitle></DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Campaign name">
              <Input value={draft.name ?? ""} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Monsoon Free Delivery" />
            </Field>
            <Field label="Campaign type">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.type}
                onChange={(e) => {
                  const t = e.target.value as CampaignType;
                  const def = CAMPAIGN_TYPES.find((x) => x.value === t);
                  setDraft({ ...draft, type: t, discount_type: def?.discount });
                }}
              >
                {CAMPAIGN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.hint}</option>)}
              </select>
            </Field>

            <Field label="Description" className="md:col-span-2">
              <Textarea value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Shown to customers on the offer card" />
            </Field>

            <Field label="Banner image URL">
              <Input value={draft.banner_url ?? ""} onChange={(e) => setDraft({ ...draft, banner_url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Promo code (optional)">
              <Input value={draft.promo_code ?? ""} onChange={(e) => setDraft({ ...draft, promo_code: e.target.value.toUpperCase() })} placeholder="MONSOON50" />
            </Field>

            <Field label="Discount value">
              <Input type="number" value={draft.discount_value ?? 0} onChange={(e) => setDraft({ ...draft, discount_value: Number(e.target.value) })} />
            </Field>
            <Field label="Maximum discount (₹)">
              <Input type="number" value={draft.max_discount ?? ""} onChange={(e) => setDraft({ ...draft, max_discount: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>

            <Field label="Minimum order value (₹)">
              <Input type="number" value={draft.min_order ?? 0} onChange={(e) => setDraft({ ...draft, min_order: Number(e.target.value) })} />
            </Field>
            <Field label="Campaign priority">
              <Input type="number" value={draft.priority ?? 0} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
            </Field>

            <Field label="Usage per user">
              <Input type="number" value={draft.usage_per_user ?? ""} onChange={(e) => setDraft({ ...draft, usage_per_user: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Unlimited" />
            </Field>
            <Field label="Total usage limit">
              <Input type="number" value={draft.total_usage_limit ?? ""} onChange={(e) => setDraft({ ...draft, total_usage_limit: e.target.value === "" ? null : Number(e.target.value) })} placeholder="Unlimited" />
            </Field>

            <Field label="Starts at">
              <Input type="datetime-local" value={toLocalInput(draft.start_at)} onChange={(e) => setDraft({ ...draft, start_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </Field>
            <Field label="Ends at">
              <Input type="datetime-local" value={toLocalInput(draft.end_at)} onChange={(e) => setDraft({ ...draft, end_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
            </Field>

            <Field label="Status">
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={draft.status ?? "draft"}
                onChange={(e) => setDraft({ ...draft, status: e.target.value as CampaignStatus })}
              >
                {(["draft", "scheduled", "active", "paused"] as CampaignStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Hour window (happy hour / midnight / flash)">
              <div className="flex items-center gap-2">
                <Input type="number" min={0} max={23} placeholder="From" value={(draft.config?.hour_from as number) ?? ""} onChange={(e) => setDraft({ ...draft, config: { ...(draft.config ?? {}), hour_from: e.target.value === "" ? undefined : Number(e.target.value) } })} />
                <Input type="number" min={0} max={23} placeholder="To" value={(draft.config?.hour_to as number) ?? ""} onChange={(e) => setDraft({ ...draft, config: { ...(draft.config ?? {}), hour_to: e.target.value === "" ? undefined : Number(e.target.value) } })} />
              </div>
            </Field>

            <div className="md:col-span-2 flex flex-wrap gap-6 rounded-2xl bg-muted/40 p-4">
              <ToggleRow label="Auto-apply best discount" checked={!!draft.auto_apply} onChange={(v) => setDraft({ ...draft, auto_apply: v })} />
              <ToggleRow label="Restaurant sponsored" checked={!!draft.sponsored} onChange={(v) => setDraft({ ...draft, sponsored: v })} />
            </div>

            <Field label="Customer segments" className="md:col-span-2">
              <Chips options={SEGMENTS} selected={draft.segments ?? []} onToggle={(v) => setDraft({ ...draft, segments: toggleIn(draft.segments, v) })} />
            </Field>
            <Field label="Payment method restrictions" className="md:col-span-2">
              <Chips options={PAYMENTS} selected={draft.payment_methods ?? []} onToggle={(v) => setDraft({ ...draft, payment_methods: toggleIn(draft.payment_methods, v) })} />
            </Field>
            <Field label="Membership restrictions" className="md:col-span-2">
              <Chips options={MEMBERSHIPS} selected={draft.memberships ?? []} onToggle={(v) => setDraft({ ...draft, memberships: toggleIn(draft.memberships, v) })} />
            </Field>
            <Field label="Categories (empty = all)" className="md:col-span-2">
              <Chips
                options={categories.map((c) => c.id)}
                labels={Object.fromEntries(categories.map((c) => [c.id, c.name ?? c.id]))}
                selected={draft.category_ids ?? []}
                onToggle={(v) => setDraft({ ...draft, category_ids: toggleIn(draft.category_ids, v) })}
              />
            </Field>
            <Field label="Restaurants (empty = all)" className="md:col-span-2">
              <Chips
                options={restaurants.slice(0, 40).map((r) => r.id)}
                labels={Object.fromEntries(restaurants.map((r) => [r.id, r.name ?? r.id]))}
                selected={draft.restaurant_ids ?? []}
                onToggle={(v) => setDraft({ ...draft, restaurant_ids: toggleIn(draft.restaurant_ids, v) })}
              />
            </Field>
            <Field label="Delivery zones (comma separated, empty = all)" className="md:col-span-2">
              <Input
                value={(draft.zone_ids ?? []).join(", ")}
                onChange={(e) => setDraft({ ...draft, zone_ids: e.target.value.split(",").map((z) => z.trim()).filter(Boolean) })}
                placeholder="Koramangala, Indiranagar"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : draft.id ? "Save changes" : "Create campaign"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 text-sm font-medium">
      <Switch checked={checked} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function Chips<T extends string>({
  options, selected, onToggle, labels,
}: { options: T[]; selected: T[]; onToggle: (v: T) => void; labels?: Record<string, string> }) {
  if (options.length === 0) return <p className="text-xs text-muted-foreground">Nothing to select.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onToggle(o)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-bold transition",
            selected.includes(o) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {labels?.[o] ?? o}
        </button>
      ))}
    </div>
  );
}

function Icon({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick} className="grid h-8 w-8 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-primary hover:text-primary-foreground">
      {children}
    </button>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={cn("rounded-3xl p-4 shadow-soft ring-1 ring-border/60", accent ? "bg-primary-soft" : "bg-card")}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}
