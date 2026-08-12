import { useState, useMemo } from "react";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle,
  XCircle,
  Edit2,
  Map,
  Clock,
  Navigation,
  FileText,
  CreditCard,
  Truck,
  Calendar,
  History,
  Star,
  IndianRupee,
  ChevronRight
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/format";
import { ExtendedDriver } from "@/lib/driver-management-api";
import { StatusBadge } from "@/components/cravio/AdminTable";

interface DriverProfileHeaderProps {
  driver: ExtendedDriver;
  onRefresh?: () => void;
}

export function DriverProfileHeader({ driver }: DriverProfileHeaderProps) {
  const joiningDate = driver.joining_date ? format(new Date(driver.joining_date), "d MMM yyyy") : "—";
  
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center">
      <Link 
        to="/admin/drivers"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition hover:bg-muted hover:text-foreground active:scale-90"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      
      <div className="flex flex-1 items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 overflow-hidden rounded-2xl bg-primary-soft shadow-glow ring-2 ring-background">
            {driver.vehicle_rc_url ? (
              <img src={driver.vehicle_rc_url} alt={driver.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-black text-primary">
                {driver.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "DP"}
              </div>
            )}
          </div>
          <div className={cn(
            "absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-background shadow-sm",
            driver.online_status ? "bg-emerald-500" : "bg-zinc-400"
          )} title={driver.online_status ? "Online" : "Offline"} />
        </div>
        
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-black tracking-tight">{driver.name}</h1>
            <StatusBadge label={driver.account_status || "Active"} />
            {driver.docs_verified && <ShieldCheck className="h-5 w-5 text-primary" />}
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            #{driver.id.slice(0, 6)} · {driver.gender || "—"}, {driver.age || "—"}y · Joined {joiningDate}
          </p>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2">
        <button className="flex items-center gap-1.5 rounded-2xl bg-card px-4 py-2 text-xs font-bold shadow-sm ring-1 ring-border transition hover:bg-muted active:scale-95">
          <Edit2 className="h-3.5 w-3.5" /> Edit Profile
        </button>
        <button className="flex items-center gap-1.5 rounded-2xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow transition hover:opacity-90 active:scale-95">
          <Navigation className="h-3.5 w-3.5" /> Track Live
        </button>
      </div>
    </div>
  );
}

export function DriverTabs({ activeTab, onTabChange, tabs }: { activeTab: string, onTabChange: (id: string) => void, tabs: { id: string, label: string, icon: any }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-border/60 pb-px">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
            {tab.label}
            {isActive && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full bg-primary shadow-[0_-2px_8px_rgba(59,130,246,0.3)]" />}
          </button>
        );
      })}
    </div>
  );
}

export function PersonalInfoSection({ driver }: { driver: ExtendedDriver }) {
  const fields = [
    { icon: User, label: "Full Name", value: driver.name },
    { icon: Mail, label: "Email", value: driver.email },
    { icon: Phone, label: "Phone", value: driver.phone, readOnly: true },
    { icon: Calendar, label: "Gender", value: driver.gender, editable: true },
    { icon: Clock, label: "Age", value: `${driver.age || "—"} Years`, editable: true },
    { icon: Calendar, label: "Language", value: driver.language || "English", editable: true },
  ];

  const addressFields = [
    { label: "Address", value: driver.address },
    { label: "City", value: driver.city },
    { label: "State", value: driver.state },
    { label: "Country", value: driver.country },
    { label: "Pincode", value: driver.pincode },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">
            <User className="h-4 w-4" /> Basic Information
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.map((f, i) => (
              <div key={i} className="group rounded-2xl bg-muted/30 p-4 transition hover:bg-muted/50 ring-1 ring-border/40">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-between">
                  {f.label}
                  {f.editable && <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition cursor-pointer" />}
                  {f.readOnly && <span className="opacity-40">(Read Only)</span>}
                </p>
                <div className="flex items-center gap-2">
                  <f.icon className="h-4 w-4 text-primary/60" />
                  <span className="font-bold text-sm truncate">{f.value || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.2em] text-muted-foreground mb-6">
            <MapPin className="h-4 w-4" /> Address & Location
          </h3>
          <div className="rounded-3xl bg-muted/20 p-6 ring-1 ring-border/40 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {addressFields.map((f, i) => (
                <div key={i} className={cn("space-y-1", i === 0 && "col-span-2")}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{f.label}</p>
                  <p className="font-bold text-sm">{f.value || "—"}</p>
                </div>
              ))}
            </div>
            
            <div className="pt-6 border-t border-border/40">
               <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Map className="h-3.5 w-3.5" /> GPS Coordinates
                  </p>
                  {driver.online_status && (
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" /> Live Location
                    </span>
                  )}
               </div>
               <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="rounded-2xl bg-background/50 p-3 ring-1 ring-border/40">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Latitude</p>
                    <p className="font-mono text-xs font-bold">{driver.current_lat || "—"}</p>
                  </div>
                  <div className="rounded-2xl bg-background/50 p-3 ring-1 ring-border/40">
                    <p className="text-[9px] font-bold text-muted-foreground uppercase mb-0.5">Longitude</p>
                    <p className="font-mono text-xs font-bold">{driver.current_lng || "—"}</p>
                  </div>
               </div>
               
               {/* Location Preview Placeholder */}
               <div className="aspect-video w-full rounded-2xl bg-muted relative overflow-hidden ring-1 ring-border/40 group">
                  {driver.current_lat && driver.current_lng ? (
                    <div className="absolute inset-0 bg-[url('https://maps.googleapis.com/maps/api/staticmap?center=' + driver.current_lat + ',' + driver.current_lng + '&zoom=14&size=600x300&markers=color:blue%7Clabel:D%7C' + driver.current_lat + ',' + driver.current_lng + '&key=')] bg-cover bg-center grayscale opacity-60 group-hover:grayscale-0 transition-all duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground font-bold uppercase tracking-widest">Location Unavailable</div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/20 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl shadow-glow">Open Google Maps</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
