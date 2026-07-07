import { createFileRoute } from "@tanstack/react-router";
import { Bike, FileCheck2, Calendar, ShieldCheck, Upload } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/rider/vehicle")({
  head: () => ({ meta: [{ title: "Scoobix Rider · Vehicle" }] }),
  component: VehiclePage,
});

const DOCS = [
  { label: "Driving licence", expires: "12 Aug 2028", status: "Verified" },
  { label: "Vehicle RC",      expires: "—",            status: "Verified" },
  { label: "Insurance",       expires: "30 Sep 2026",  status: "Renew soon" },
  { label: "PAN card",        expires: "—",            status: "Verified" },
];

function VehiclePage() {
  return (
    <div className="mx-auto min-h-svh max-w-[520px] pb-24">
      <PageHeader title="Vehicle details" />

      <section className="mx-4 mt-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary"><Bike className="h-6 w-6" strokeWidth={2.4} /></span>
          <div>
            <h3 className="font-display text-base font-bold">Honda Activa 6G</h3>
            <p className="text-xs text-muted-foreground">Scooter · KA 03 9981 · 2024</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Field label="Make"  value="Honda" />
          <Field label="Model" value="Activa 6G" />
          <Field label="Year"  value="2024" />
          <Field label="Colour" value="Pearl White" />
        </div>
      </section>

      <section className="mx-4 mt-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
        <h3 className="flex items-center gap-2 text-sm font-bold"><ShieldCheck className="h-4 w-4 text-primary" /> Documents</h3>
        <ul className="mt-3 divide-y divide-border/60">
          {DOCS.map((d) => (
            <li key={d.label} className="flex items-center gap-3 py-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary"><FileCheck2 className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold">{d.label}</div>
                <div className="text-xs text-muted-foreground"><Calendar className="mr-1 inline h-3 w-3" />{d.expires}</div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${d.status === "Verified" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{d.status}</span>
            </li>
          ))}
        </ul>
        <Button onClick={() => toast.success("Document uploaded")} variant="outline" className="mt-3 w-full rounded-2xl border-2 border-dashed border-border"><Upload className="mr-2 h-4 w-4" /> Upload new document</Button>
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</Label>
      <Input defaultValue={value} className="h-10 rounded-xl bg-secondary/60 text-sm" />
    </div>
  );
}
