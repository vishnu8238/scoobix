import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { 
  fetchDriverDetails, 
  fetchDriverOrders, 
  fetchDriverPayouts 
} from "@/lib/driver-management-api";
import { getPayoutPeriods } from "@/lib/payouts-api";
import { fetchRiderGigs } from "@/lib/gigs-api";
import { getWalletSummary } from "@/lib/loyalty-engine";
import { 
  fetchDocs, 
  RIDER_DOCS, 
  normalizeStatus, 
  KYC_STATUS_LABEL, 
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
import { useAuth } from "@/lib/auth-store";
import { PortalSkeleton } from "@/components/skeletons/PortalSkeletons";

export const Route = createFileRoute("/logistics/drivers/$driverId")({
  component: LogisticsDriverProfilePage,
  // SSR SAFETY: Loader removed to prevent protected table reads (users, drivers) during server rendering.
  // Data is fetched exclusively on the client after AuthProvider hydration.
});

const PRIMARY_TABS = [
  { id: "profile", label: "Partner Profile", icon: User },
  { id: "gigs", label: "Gigs History", icon: Briefcase },
  { id: "karma", label: "Karma Details", icon: Star },
  { id: "zone", label: "Zone", icon: MapPin },
  { id: "payouts", label: "Payout History", icon: IndianRupee },
  { id: "payouts_ledger", label: "Payout Ledger", icon: FileText },
  { id: "orders", label: "Order History", icon: Truck },
  { id: "attendance", label: "Attendance", icon: Calendar },
  { id: "cod", label: "COD Transactions", icon: IndianRupee },
];

const SECONDARY_TABS = [
  { id: "personal", label: "Personal", icon: User },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "vehicle", label: "Vehicle", icon: Truck },
  { id: "bank", label: "Bank", icon: CreditCard },
];

function LogisticsDriverProfilePage() {
  const { driverId } = Route.useParams();
  const { user, hydrationComplete } = useAuth();
  
  // SSR SAFETY: Query is enabled only on the client after auth hydration.
  const { data: driver, isLoading } = useQuery({
    queryKey: ["logistics", "driver-profile", driverId],
    queryFn: () => fetchDriverDetails(driverId),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
  });

  const [activeTab, setActiveTab] = useState("profile");
  const [activeSubTab, setActiveSubTab] = useState("personal");

  if (!hydrationComplete || isLoading) {
    return <div className="p-8 max-w-[1600px] mx-auto"><PortalSkeleton /></div>;
  }

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
                {activeSubTab === "documents" && <DocumentsTab driverId={driverId} user_id={driver.user_id} />}
                {activeSubTab === "vehicle" && <DetailGrid items={[
                  { label: "Vehicle Type", value: driver.vehicle_type || "Unassigned" },
                  { label: "Vehicle Number", value: driver.vehicle_number || "Unassigned" },
                  { label: "License Number", value: driver.license_number || "Unassigned" },
                  { label: "Verification", value: driver.verification_status || "Unavailable" }
                ]} />}
                {activeSubTab === "bank" && <DetailGrid items={[
                  { label: "Account Holder", value: driver.bank_holder || driver.name || "Unassigned" },
                  { label: "Bank Name", value: driver.bank_name || "Unassigned" },
                  { label: "Account Number", value: driver.bank_account || "Unassigned" },
                  { label: "IFSC Code", value: driver.bank_ifsc || "Unassigned" }
                ]} />}

              </div>
            </div>
          )}
          
          {activeTab === "orders" && <OrdersTab driverId={driverId} />}
          {activeTab === "payouts" && <PayoutsTab driverId={driverId} />}
          {activeTab === "payouts_ledger" && <PayoutLedgerTab driverId={driverId} />}
          {activeTab === "gigs" && <GigsTab userId={driver.user_id} />}
          {activeTab === "karma" && <KarmaTab userId={driver.user_id} />}
          {activeTab === "zone" && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <MapPin className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="font-display font-bold text-lg text-rose-500">No logistics zone assignment is recorded</p>
              <p className="text-sm mt-1 text-muted-foreground">This partner is not currently mapped to an authoritative delivery zone.</p>
            </div>
          )}
          {activeTab === "attendance" && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <Calendar className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="font-display font-bold text-lg text-rose-500">Attendance tracking is not configured</p>
              <p className="text-sm mt-1 text-muted-foreground">No shift or clock-in schema is available for this partner.</p>
            </div>
          )}
          {activeTab === "cod" && (
            <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
              <IndianRupee className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="font-display font-bold text-lg text-rose-500">COD ledger is not configured</p>
              <p className="text-sm mt-1 text-muted-foreground">No authoritative COD ledger exists for this partner.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ driverId, user_id }: { driverId: string, user_id?: string }) {
  const { user, hydrationComplete } = useAuth();
  const { data: docs, isLoading } = useQuery({
    queryKey: ["logistics", "driver-docs", user_id || driverId],
    queryFn: () => fetchDocs("rider", user_id || driverId),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
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
  const { user, hydrationComplete } = useAuth();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["logistics", "driver-orders", driverId],
    queryFn: () => fetchDriverOrders(driverId),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
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
  const { user, hydrationComplete } = useAuth();
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["logistics", "driver-payouts", driverId],
    queryFn: () => fetchDriverPayouts(driverId),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

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

function PayoutLedgerTab({ driverId }: { driverId: string }) {
  const { user, hydrationComplete } = useAuth();
  const { data: payouts, isLoading } = useQuery({
    queryKey: ["logistics", "driver-payout-ledger", driverId],
    queryFn: () => getPayoutPeriods({ driver_id: `eq.${driverId}` }),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!payouts?.length) return <EmptyState label="No payout ledger records found." icon={FileText} />;

  return (
    <DataTable
      columns={["Period", "Gross", "Deductions", "Net", "Status"]}
      rows={payouts.map((p: any) => [
        <span key={p.id+"pd"} className="font-bold">{format(new Date(p.period_start), "MMM d")} - {format(new Date(p.period_end), "MMM d, yyyy")}</span>,
        <span key={p.id+"g"} className="font-medium">₹{Number(p.gross_earnings).toFixed(2)}</span>,
        <span key={p.id+"td"} className="font-medium text-rose-600">-₹{Number(p.total_deductions).toFixed(2)}</span>,
        <span key={p.id+"n"} className="font-black">₹{Number(p.net_payable).toFixed(2)}</span>,
        <StatusBadge key={p.id+"s"} label={p.status} />
      ])}
    />
  );
}

function GigsTab({ userId }: { userId?: string }) {
  const { user, hydrationComplete } = useAuth();
  const { data: gigs, isLoading } = useQuery({
    queryKey: ["logistics", "driver-gigs", userId],
    queryFn: () => userId ? fetchRiderGigs(userId) : Promise.resolve([]),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!gigs?.length) return <EmptyState label="No Gig enrollment history" icon={Briefcase} />;

  return (
    <DataTable
      columns={["Gig Title", "Date", "Time", "Status", "Completion", "Reward"]}
      rows={gigs.map((g: any) => [
        <span key={g.id+"t"} className="font-bold">{g.title || "Unavailable"}</span>,
        <span key={g.id+"d"} className="text-muted-foreground">{g.start_time ? format(new Date(g.start_time), "d MMM yyyy") : "Unavailable"}</span>,
        <span key={g.id+"tm"} className="text-[10px] font-bold">
          {g.start_time ? format(new Date(g.start_time), "h:mm a") : ""} - {g.end_time ? format(new Date(g.end_time), "h:mm a") : ""}
        </span>,
        <StatusBadge key={g.id+"s"} label={g.enrollment?.status || "Unavailable"} />,
        <span key={g.id+"c"} className="font-medium">{g.enrollment?.completed_deliveries ?? 0} / {g.target_deliveries || "—"}</span>,
        <span key={g.id+"r"} className="font-black text-emerald-600">₹{g.reward_amount || 0}</span>
      ])}
    />
  );
}

function KarmaTab({ userId }: { userId?: string }) {
  const { user, hydrationComplete } = useAuth();
  const { data: wallet, isLoading } = useQuery({
    queryKey: ["logistics", "driver-karma", userId],
    queryFn: () => userId ? getWalletSummary(userId) : Promise.resolve(null),
    enabled: typeof window !== "undefined" && hydrationComplete && !!user,
  });

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!wallet) return <EmptyState label="Unavailable" icon={Star} />;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-3xl bg-muted/20 ring-1 ring-border/40">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Current Points</p>
          <p className="text-3xl font-black">{wallet.balance || 0}</p>
        </div>
        <div className="p-6 rounded-3xl bg-muted/20 ring-1 ring-border/40">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Lifetime Earned</p>
          <p className="text-3xl font-black">{wallet.lifetimeCredited || 0}</p>
        </div>
        <div className="p-6 rounded-3xl bg-muted/20 ring-1 ring-border/40">
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Account Status</p>
          <div className="mt-2">
            <StatusBadge label={wallet.blocked ? "Blocked" : "Active"} />
          </div>
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
        <History className="h-8 w-8 mb-4 text-muted-foreground" />
        <p className="font-display font-bold text-lg">No karma events recorded</p>
      </div>
    </div>
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
