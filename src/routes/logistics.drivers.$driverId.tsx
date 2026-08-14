import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  fetchDriverDetails, 
  fetchDriverOrders, 
  fetchDriverPayouts 
} from "@/lib/driver-management-api";
import { 
  fetchDocs, 
  RIDER_DOCS, 
  normalizeStatus, 
  KYC_STATUS_LABEL, 
  KYC_STATUS_TONE 
} from "@/lib/verification-api";
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
  Loader2,
  Package,
  Activity,
  Briefcase,
  FileCheck,
  Zap
} from "lucide-react";
import { DriverProfileHeader, DriverTabs, PersonalInfoSection } from "@/components/admin/DriverProfileComponents";
import { DataTable, StatusBadge } from "@/components/cravio/AdminTable";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/logistics/drivers/$driverId")({
  component: LogisticsDriverProfilePage,
  loader: ({ params }) => fetchDriverDetails(params.driverId),
});

const PRIMARY_TABS = [
  { id: "profile", label: "Partner Profile", icon: User },
  { id: "assets", label: "Assets", icon: Package },
  { id: "services", label: "Services", icon: Zap },
  { id: "localities", label: "Localities", icon: MapPin },
  { id: "payouts", label: "Payout History", icon: IndianRupee },
  { id: "orders", label: "Order History", icon: Truck },
  { id: "logs", label: "Activity Logs", icon: Activity },
  { id: "migration", label: "Migration Details", icon: Briefcase },
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
              <nav className="flex gap-8 mb-8 overflow-x-auto pb-2 scrollbar-none">
                {SECONDARY_TABS.map(tab => {
                  const isActive = activeSubTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSubTab(tab.id)}
                      className={`flex items-center gap-2 text-sm font-bold transition-all whitespace-nowrap ${
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
                {activeSubTab === "documents" && <DocumentsTab driverId={driverId} />}
                {activeSubTab === "vehicle" && <DetailGrid items={[
                  { label: "Vehicle Type", value: driver.vehicle_type || "—" },
                  { label: "Vehicle Model", value: driver.vehicle_model || "—" },
                  { label: "Vehicle Number", value: driver.vehicle_number || "—" },
                  { label: "RC Status", value: "Verified", tone: "success" }
                ]} />}
                {activeSubTab === "bank" && <DetailGrid items={[
                  { label: "Account Holder", value: driver.bank_holder || driver.name || "—" },
                  { label: "Bank Name", value: driver.bank_name || "—" },
                  { label: "Account Number", value: driver.bank_account || "—" },
                  { label: "IFSC Code", value: driver.bank_ifsc || "—" }
                ]} />}

              </div>
            </div>
          )}
          
          {activeTab === "orders" && <OrdersTab driverId={driverId} />}
          {activeTab === "payouts" && <PayoutsTab driverId={driverId} />}
          {activeTab === "assets" && <EmptyState label="No assets assigned (Bags, T-Shirts, etc.)" icon={Package} />}
          {activeTab === "services" && <EmptyState label="No active service subscriptions" icon={Zap} />}
          {activeTab === "localities" && <EmptyState label="No specific localities assigned" icon={MapPin} />}
          {activeTab === "logs" && <EmptyState label="No recent activity logs" icon={Activity} />}
          {activeTab === "migration" && <EmptyState label="No migration metadata found" icon={Briefcase} />}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ driverId }: { driverId: string }) {
  const { data: docs, isLoading } = useSuspenseQuery({
    queryKey: ["logistics", "driver-docs", driverId],
    queryFn: () => fetchDocs("rider", driverId),
  });

  if (isLoading) return <Loader2 className="animate-spin h-6 w-6 mx-auto" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {RIDER_DOCS.map(def => {
        const doc = docs.find(d => d.doc_type === def.type);
        const status = normalizeStatus(doc?.status);
        return (
          <div key={def.type} className="p-5 rounded-3xl bg-muted/30 ring-1 ring-border/40 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-card flex items-center justify-center text-primary shadow-sm">
                <FileCheck className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black">{def.label}</span>
                  {def.mandatory && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 rounded uppercase">Required</span>}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground">{doc?.doc_number || def.numberLabel}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge label={KYC_STATUS_LABEL[status]} />
              {doc?.file_url ? (
                <a 
                  href={doc.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-black text-primary hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-2.5 w-2.5" /> View File
                </a>
              ) : (
                <span className="text-[10px] font-bold text-muted-foreground/40 italic">Not Uploaded</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DetailGrid({ items }: { items: any[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{item.label}</p>
          <p className="text-sm font-bold text-foreground">{item.value}</p>
        </div>
      ))}
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

function EmptyState({ label, icon: Icon = History }: { label: string, icon?: any }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
      <Icon className="h-12 w-12 mb-4 text-muted-foreground" />
      <p className="font-display font-bold text-lg">{label}</p>
      <p className="text-sm mt-1">Real-time data will appear here once available.</p>
    </div>
  );
}

function ExternalLink({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
      <polyline points="15 3 21 3 21 9"></polyline>
      <line x1="10" y1="14" x2="21" y2="3"></line>
    </svg>
  );
}
