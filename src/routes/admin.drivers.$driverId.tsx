import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { fetchDriverDetails } from "@/lib/driver-management-api";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin/drivers/$driverId")({
  component: DriverProfilePage,
  loader: ({ params }) => fetchDriverDetails(params.driverId),
});

function DriverProfilePage() {
  const { driverId } = Route.useParams();
  const { data: driver } = useSuspenseQuery({
    queryKey: ["admin", "driver-profile", driverId],
    queryFn: () => fetchDriverDetails(driverId),
  });

  if (!driver) return <div className="p-8 text-center">Driver not found</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center font-bold text-xl text-primary">
          {driver.name?.slice(0, 2).toUpperCase() || "DR"}
        </div>
        <div>
          <h1 className="font-display text-3xl font-extrabold">{driver.name || "Unknown Driver"}</h1>
          <p className="text-muted-foreground font-medium">
            #{driver.id.slice(0, 6)} · {driver.gender || "—"} · {driver.age || "—"}y · Joined {driver.joining_date || "—"}
          </p>
        </div>
      </header>

      {/* Tabs placeholder matching structure */}
      <nav className="flex gap-6 border-b border-border/60 overflow-x-auto">
        {["Partner Profile", "Payout History", "Order History", "Attendance", "Zone", "Gigs History", "Karma Details", "COD Transactions"].map((tab) => (
          <button key={tab} className="pb-4 border-b-2 border-transparent font-bold text-sm text-muted-foreground hover:text-primary hover:border-primary whitespace-nowrap">
            {tab}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="font-bold text-lg mb-4">Personal Information</h2>
            <div className="space-y-4">
                <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Full Name</span>
                    <span className="font-bold">{driver.name}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-muted-foreground text-sm">Email</span>
                    <span className="font-bold">{driver.email}</span>
                </div>
            </div>
        </div>
        <div className="rounded-3xl bg-card p-6 shadow-card ring-1 ring-border/60">
            <h2 className="font-bold text-lg mb-4">GPS Coordinates</h2>
            <p className="text-muted-foreground">Lat: {driver.current_lat} · Long: {driver.current_lng}</p>
        </div>
      </section>
    </div>
  );
}
