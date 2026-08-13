import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  fetchDriverDetails, 
  fetchDriverOrders, 
  fetchDriverPayouts 
} from "@/lib/driver-management-api";
import { 
  User, 
  CreditCard, 
  Truck, 
  History, 
  MapPin, 
  Sparkles, 
  Star, 
  IndianRupee,
  ShieldCheck,
  FileText,
  Calendar,
  Loader2
} from "lucide-react";
import { DriverProfileHeader, DriverTabs, PersonalInfoSection } from "@/components/admin/DriverProfileComponents";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { format } from "date-fns";

export const Route = createFileRoute("/logistics/drivers/$driverId")({
  component: LogisticsDriverProfilePage,
  loader: ({ params }) => fetchDriverDetails(params.driverId),
});

const PRIMARY_TABS = [
  { id: "profile", label: "Partner Profile", icon: User },
  { id: "payouts", label: "Payout History", icon: IndianRupee },
  { id: "orders", label: "Order History", icon: Truck },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "zone", label: "Zone", icon: MapPin },
  { id: "gigs", label: "Gigs History", icon: Sparkles },
  { id: "karma", label: "Karma Details", icon: Star },
  { id: "cod", label: "COD Transactions", icon: CreditCard },
];

const SECONDARY_TABS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "vehicle", label: "Vehicle", icon: Truck },
  { id: "bank", label: "Bank", icon: CreditCard },
];

function LogisticsDriverProfilePage() {
  const { driverId } = Route.useParams();
  const { data: driver } = useSuspenseQuery({
    queryKey: ["logistics", "driver-profile", driverId],
    queryFn: () => fetchDriverDetails(driverId),
  });

  const [activeTab, setActiveTab] = useState("profile");
  const [activeSubTab, setActiveSubTab] = useState("personal");

  if (!driver) return <div className="p-8 text-center font-display font-bold">Driver not found</div>;

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8 space-y-8 max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
      <DriverProfileHeader driver={driver} />
      
      <div className="rounded-[2.5rem] bg-card shadow-card ring-1 ring-border/60 overflow-hidden">
        <DriverTabs 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          tabs={PRIMARY_TABS} 
        />
        
        <div className="p-6 lg:p-10">
          {activeTab === "profile" && (
            <div className="space-y-8">
              <nav className="flex gap-8 mb-8">
                {SECONDARY_TABS.map(tab => {
                  const isActive = activeSubTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id)}
                      className={`flex items-center gap-2 text-sm font-bold transition-all ${
                        isActive ? "text-primary scale-105" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                      {isActive && <div className="h-1 w-1 rounded-full bg-primary ml-1" />}
                    </button>
                  );
                })}
              </nav>
              
              <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                {activeSubTab === "personal" && <PersonalInfoSection driver={driver} />}
                {activeSubTab === "documents" && <EmptyState label="No documents uploaded yet" />}
                {activeSubTab === "vehicle" && <EmptyState label="Vehicle details not provided" />}
                {activeSubTab === "bank" && <EmptyState label="Bank account not linked" />}
              </div>
            </div>
          )}
          
          {activeTab === "orders" && <OrdersTab driverId={driverId} />}
          {activeTab === "payouts" && <PayoutsTab driverId={driverId} />}
          {activeTab !== "profile" && activeTab !== "orders" && activeTab !== "payouts" && (
             <EmptyState label={`No ${PRIMARY_TABS.find(t => t.id === activeTab)?.label} records available.`} />
          )}
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ driverId }: { driverId: string }) {
  const { data: orders, isLoading } = useSuspenseQuery({
    queryKey: ["logistics", "driver-orders", driverId],
    queryFn: () => fetchDriverOrders(driverId),
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!orders?.length) return <EmptyState label="No order history found for this driver" />;

  return (
    <DataTable
      columns={["Order ID", "Date", "Status", "Earnings", "Restaurant"]}
      rows={orders.map((o: any) => [
        <span key={o.id+"id"} className="font-bold text-primary">#{o.id.slice(0, 8)}</span>,
        <span key={o.id+"d"} className="text-muted-foreground">{format(new Date(o.created_at), "d MMM, h:mm a")}</span>,
        <StatusBadge key={o.id+"s"} label={o.status} />,
        <span key={o.id+"e"} className="font-black text-emerald-600">₹{o.driver_earnings || 0}</span>,
        <span key={o.id+"r"} className="font-medium">{o.restaurant_name || "—"}</span>
      ])}
    />
  );
}

function PayoutsTab({ driverId }: { driverId: string }) {
  const { data: payouts } = useSuspenseQuery({
    queryKey: ["logistics", "driver-payouts", driverId],
    queryFn: () => fetchDriverPayouts(driverId),
  });

  if (!payouts?.length) return <EmptyState label="No payout records available." />;

  return (
    <DataTable
      columns={["Transfer ID", "Date", "Amount", "Status", "Method"]}
      rows={payouts.map((p: any) => [
        <span key={p.id+"id"} className="font-bold text-primary">#{p.id.slice(0, 8)}</span>,
        <span key={p.id+"d"} className="text-muted-foreground">{format(new Date(p.created_at), "d MMM yyyy")}</span>,
        <span key={p.id+"a"} className="font-black">₹{p.amount || 0}</span>,
        <StatusBadge key={p.id+"s"} label={p.status || "Paid"} />,
        <span key={p.id+"m"} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{p.method || "Bank Transfer"}</span>
      ])}
    />
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
      <History className="h-12 w-12 mb-4 text-muted-foreground" />
      <p className="font-display font-bold text-lg">{label}</p>
      <p className="text-sm mt-1">Real-time data will appear here once available.</p>
    </div>
  );
}
