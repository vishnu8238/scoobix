import { createFileRoute, Link } from "@tanstack/react-router";
import { Star, Phone, Mail, Bike, FileText, ChevronRight, Award, Shield } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { SecurityPanel } from "@/components/security/SecurityPanel";

export const Route = createFileRoute("/rider/profile")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Profile" }] }),
  component: RiderProfile,
});

const ME = {
  name: "Aarav Mehta",
  vehicle: "Scooter · KA 03 9981",
  rating: 4.95,
  trips: 1842,
  joined: "Mar 2024",
  phone: "+91 98xxx 21092",
  email: "aarav@cravio.app",
  level: "Gold partner",
};

const ITEMS = [
  { to: "/rider/vehicle",  icon: Bike,    label: "Vehicle details",   desc: "Documents · insurance · RC" },
  { to: "/rider/history",  icon: FileText,label: "Delivery history",  desc: "Last 30 days of trips" },
  { to: "/rider/earnings", icon: Award,   label: "Earnings breakdown",desc: "Base · tips · bonus" },
  { to: "/terms",          icon: FileText,label: "Rider terms",       desc: "Legal" },
  { to: "/privacy",        icon: Shield,  label: "Privacy policy",    desc: "How we handle your data" },
];

function RiderProfile() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Profile" />

      <section className="mx-4 mt-2 rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white/20 text-2xl font-extrabold backdrop-blur-md ring-2 ring-white/40">AM</div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-extrabold leading-tight">{ME.name}</h2>
            <p className="text-[12px] opacity-90">{ME.vehicle}</p>
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md"><Star className="h-3 w-3 fill-current" /> {ME.rating} · {ME.level}</div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3 text-center">
          <Stat label="Trips" value={ME.trips.toLocaleString("en-IN")} />
          <Stat label="Joined" value={ME.joined} />
          <Stat label="Rating" value={ME.rating.toFixed(2)} />
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
        <Row icon={<Phone className="h-4 w-4 text-primary" />} label="Phone"  value={ME.phone} />
        <Row icon={<Mail className="h-4 w-4 text-primary" />}  label="Email"  value={ME.email} />
      </section>

      <ul className="mx-4 mt-4 divide-y divide-border/60 rounded-3xl bg-card shadow-soft ring-1 ring-border/60">
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-md">
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-90">{label}</div>
      <div className="mt-1 font-display text-lg font-extrabold">{value}</div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft">{icon}</span>
      <div className="min-w-0 flex-1"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div><div className="truncate text-sm font-bold">{value}</div></div>
    </div>
  );
}
