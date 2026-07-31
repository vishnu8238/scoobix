import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, User, Bike, KeyRound, FileText, Wallet, Shield, Bell, LifeBuoy, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";

export const Route = createFileRoute("/rider/more")({
  head: () => ({ meta: [{ title: "Scoobix Rider · More" }] }),
  component: RiderMore,
});

const ITEMS = [
  { to: "/rider/ai",      icon: Sparkles, label: "AI Coach",            desc: "Routes, earnings & peak hours" },
  { to: "/rider/profile", icon: User,     label: "Rider profile",       desc: "Your account & rating" },
  { to: "/rider/vehicle", icon: Bike,     label: "Vehicle & documents", desc: "RC, licence, insurance" },
  { to: "/rider/otp",     icon: KeyRound, label: "Complete delivery (OTP)", desc: "Hand-off verification" },
  { to: "/rider/history", icon: FileText, label: "Delivery history",    desc: "Past trips & status" },
  { to: "/rider/earnings",icon: Wallet,   label: "Earnings breakdown",  desc: "Base · tips · bonus" },
  { to: "/rider/notifications", icon: Bell,label: "Notifications",      desc: "Trip alerts & payouts" },
  { to: "/rider/support", icon: LifeBuoy, label: "Help & support",      desc: "Raise a ticket, track replies" },
  { to: "/terms",         icon: FileText, label: "Rider terms",         desc: "Legal" },
  { to: "/privacy",       icon: Shield,   label: "Privacy policy",      desc: "Data handling" },
];

function RiderMore() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Rider hub" subtitle="Profile, earnings, support" />
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
