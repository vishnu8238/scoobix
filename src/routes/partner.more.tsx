import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Sparkles, Clock, Layers, Bell, FileText, BarChart3, Shield } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";

export const Route = createFileRoute("/partner/more")({
  head: () => ({ meta: [{ title: "Scoobix Partner · More" }] }),
  component: PartnerMore,
});

const ITEMS = [
  { to: "/partner/onboarding",   icon: Sparkles, label: "Restaurant onboarding", desc: "Get listed in 4 steps" },
  { to: "/partner/hours",        icon: Clock,    label: "Opening hours",         desc: "When you accept orders" },
  { to: "/partner/addons",       icon: Layers,   label: "Add-ons & variants",    desc: "Sizes, toppings, choices" },
  { to: "/partner/notifications",icon: Bell,     label: "New order alerts",      desc: "Accept · reject with reason" },
  { to: "/partner/analytics",    icon: BarChart3,label: "Sales analytics",       desc: "Trends, top items" },
  { to: "/partner/invoice",      icon: FileText, label: "Invoices",              desc: "Tax breakdowns, payouts" },
  { to: "/terms",                icon: FileText, label: "Partner terms",         desc: "Legal" },
  { to: "/privacy",              icon: Shield,   label: "Privacy policy",        desc: "Data handling" },
];

function PartnerMore() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Partner hub" subtitle="Setup & operations" />
      <ul className="mx-4 mt-3 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
        {ITEMS.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-3 px-4 py-3.5 transition active:bg-muted/40">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary"><i.icon className="h-5 w-5" strokeWidth={2.4} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{i.label}</div>
                <div className="truncate text-xs text-muted-foreground">{i.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
