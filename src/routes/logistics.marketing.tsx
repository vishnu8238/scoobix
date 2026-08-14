import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Megaphone, Plus, Pause, Play, Copy, Archive, Pencil, BarChart3, RotateCcw, History,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatPrice, cn } from "@/lib/format";
import { useAuth } from "@/lib/auth-store";
import {
  CAMPAIGN_TYPE_LABEL, campaignAnalytics, effectiveStatus,
  listCampaigns, archiveCampaign, restoreCampaign,
  duplicateCampaign, setCampaignStatus, listAuditLogs, impressionsByCampaign,
  type Campaign, type CampaignAudit, type CampaignStatus,
} from "@/lib/campaigns-api";

export const Route = createFileRoute("/logistics/marketing")({
  head: () => ({
    meta: [
      { title: "Scoobix Logistics · Marketing campaigns" },
      { name: "description", content: "Create, schedule and measure Scoobix promotional campaigns." },
    ],
  }),
  component: LogisticsMarketing,
});

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-100 text-blue-700",
  active: "bg-emerald-100 text-emerald-700",
  paused: "bg-amber-100 text-amber-700",
  expired: "bg-rose-100 text-rose-700",
  archived: "bg-zinc-200 text-zinc-600",
};

function LogisticsMarketing() {
  const { user } = useAuth();
  const actor = { id: user?.id, email: user?.email };

  const [list, setList] = useState<Campaign[]>([]);
  const [impressions, setImpressions] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<CampaignAudit[]>([]);
  const [loading, setLoading] = useState(true);

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

  const act = async (fn: Promise<unknown>, msg: string) => {
    await fn;
    toast.success(msg);
    void refresh();
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Marketing</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">Campaigns</h1>
          <p className="mt-1 text-sm text-muted-foreground">Monitor and manage platform promotions.</p>
        </div>
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
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Code</TableHead>
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
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-xs">{CAMPAIGN_TYPE_LABEL[c.type]}</TableCell>
                        <TableCell className="font-mono text-xs">{c.promo_code ?? "—"}</TableCell>
                        <TableCell>{c.used_count ?? 0}</TableCell>
                        <TableCell>
                          <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", STATUS_STYLE[st])}>{st}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {st === "paused" || st === "draft" ? (
                              <button title="Activate" onClick={() => act(setCampaignStatus(c.id, "active", actor), "Campaign resumed")} className="p-1 hover:bg-muted rounded"><Play className="h-3.5 w-3.5" /></button>
                            ) : (
                              <button title="Pause" onClick={() => act(setCampaignStatus(c.id, "paused", actor), "Campaign paused")} className="p-1 hover:bg-muted rounded"><Pause className="h-3.5 w-3.5" /></button>
                            )}
                            <button title="Duplicate" onClick={() => act(duplicateCampaign(c, actor), "Campaign duplicated")} className="p-1 hover:bg-muted rounded"><Copy className="h-3.5 w-3.5" /></button>
                            {c.archived ? (
                              <button title="Restore" onClick={() => act(restoreCampaign(c.id, actor), "Campaign restored")} className="p-1 hover:bg-muted rounded"><RotateCcw className="h-3.5 w-3.5" /></button>
                            ) : (
                              <button title="Archive" onClick={() => act(archiveCampaign(c.id, actor), "Campaign archived")} className="p-1 hover:bg-muted rounded"><Archive className="h-3.5 w-3.5" /></button>
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
                    </TableRow>
                  );
                })}
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
            </ul>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-xl font-extrabold", accent && "text-primary")}>{value}</p>
    </div>
  );
}
