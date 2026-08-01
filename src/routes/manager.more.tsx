import { createFileRoute, Link } from "@tanstack/react-router";
import { LifeBuoy, Bell, User, LogOut, ChevronRight, History, CalendarDays, ArrowLeftRight, Sparkles, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { useAuth } from "@/lib/auth-store";
import { useManager } from "@/lib/manager-api";

export const Route = createFileRoute("/manager/more")({
  head: () => ({
    meta: [
      { title: "Scoobix Merchant Manager · More" },
      { name: "description", content: "Profile, notifications and support for merchant managers." },
    ],
  }),
  component: ManagerMore,
});

const LINKS = [
  { to: "/manager/calendar", label: "Meetings & follow-ups", icon: CalendarDays },
  { to: "/manager/history", label: "Onboarding history", icon: History },
  { to: "/manager/transfers", label: "Ownership transfers", icon: ArrowLeftRight },
  { to: "/manager/support", label: "Restaurant support tickets", icon: LifeBuoy },
  { to: "/manager/notifications", label: "Notifications", icon: Bell },
  { to: "/manager/verification", label: "My verification & KYC", icon: ShieldCheck },
  { to: "/manager/profile", label: "My profile", icon: User },
];


function ManagerMore() {
  const { user, signOut } = useAuth();
  const { manager } = useManager();

  return (
    <div className="mx-auto max-w-[520px] pb-6">
      <PageHeader title="More" back={false} />
      <div className="px-5 pt-4">
        <div className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <p className="font-display text-lg font-extrabold">{manager?.name || user?.name}</p>
          <p className="text-[12px] text-muted-foreground">{manager?.email || user?.email}</p>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-primary">
            Merchant Manager{manager?.region ? ` · ${manager.region}` : ""}
          </p>
        </div>

        <div className="mt-4 space-y-2.5">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60"
            >
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary-soft text-primary">
                <l.icon className="h-4.5 w-4.5" strokeWidth={2.4} />
              </div>
              <span className="flex-1 text-sm font-semibold">{l.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>

        <button
          onClick={signOut}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-3xl bg-muted p-4 text-sm font-bold text-muted-foreground"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
