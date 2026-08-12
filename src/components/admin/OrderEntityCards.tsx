import { Building2, User, Truck, MapPin, Phone, Star } from "lucide-react";
import { cn } from "@/lib/format";

export function RestaurantCard({ restaurant, order }: { restaurant: any; order: any }) {
  if (!restaurant) return (
    <div className="rounded-3xl bg-muted/50 p-6 flex flex-col items-center justify-center text-center">
      <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm font-medium text-muted-foreground">Restaurant data unavailable</p>
    </div>
  );

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-extrabold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Restaurant Details
        </h3>
        <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary px-2 py-0.5 rounded-full">
          {restaurant.subzone || "Main Zone"}
        </span>
      </div>
      
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <img 
            src={restaurant.cover || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=100&h=100&fit=crop"} 
            className="h-12 w-12 rounded-xl object-cover"
            alt={restaurant.name}
          />
          <div>
            <p className="font-bold text-sm">{restaurant.name}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {restaurant.address || "No address provided"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
          <div className="p-2 rounded-2xl bg-muted/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Contact</p>
            <p className="text-xs font-semibold flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {restaurant.phone || "N/A"}
            </p>
          </div>
          <div className="p-2 rounded-2xl bg-muted/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Status</p>
            <p className="text-xs font-semibold">{restaurant.status || "ACTIVE"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CustomerCard({ customer, order }: { customer: any; order: any }) {
  if (!customer) return (
    <div className="rounded-3xl bg-muted/50 p-6 flex flex-col items-center justify-center text-center">
      <User className="h-8 w-8 text-muted-foreground mb-2" />
      <p className="text-sm font-medium text-muted-foreground">Customer data unavailable</p>
    </div>
  );

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h3 className="font-display font-extrabold flex items-center gap-2 mb-4">
        <User className="h-5 w-5 text-primary" />
        Customer Details
      </h3>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm">{customer.full_name || customer.name || "Guest User"}</p>
            <p className="text-xs text-muted-foreground">{customer.email || "No email"}</p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-muted/30">
          <p className="text-[9px] font-bold uppercase text-muted-foreground mb-1">Delivery Address</p>
          <p className="text-xs font-medium leading-relaxed">
            <span className="block font-bold mb-0.5">{order.addressLabel || "Default Location"}</span>
            {order.addressLine || "No specific address line provided"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex-1 py-2 rounded-xl bg-muted hover:bg-muted/80 text-[10px] font-bold transition">
            View History
          </button>
          <button className="flex-1 py-2 rounded-xl bg-muted hover:bg-muted/80 text-[10px] font-bold transition">
            Contact User
          </button>
        </div>
      </div>
    </div>
  );
}

export function RiderCard({ rider, order }: { rider: any; order: any }) {
  if (!rider && !order.driver_id) return (
    <div className="rounded-3xl bg-amber-50/50 p-6 flex flex-col items-center justify-center text-center ring-1 ring-amber-100">
      <Truck className="h-8 w-8 text-amber-500 mb-2" />
      <p className="text-sm font-bold text-amber-700">Rider Not Assigned</p>
      <p className="text-[10px] text-amber-600/80 mt-1">Pending manual or auto dispatch</p>
    </div>
  );

  const d = rider || order.driver || {};

  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-extrabold flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          Rider Details
        </h3>
        {d.rating && (
          <span className="text-[10px] font-bold flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
            <Star className="h-3 w-3 fill-emerald-600" />
            {d.rating}
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <img 
            src={d.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${d.id || 'rider'}`} 
            className="h-12 w-12 rounded-xl bg-muted object-cover"
            alt={d.name}
          />
          <div>
            <p className="font-bold text-sm">{d.name || "Unknown Rider"}</p>
            <p className="text-xs text-muted-foreground">{d.vehicle || "Standard Vehicle"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-2xl bg-muted/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Phone</p>
            <p className="text-xs font-semibold">{d.phone || "N/A"}</p>
          </div>
          <div className="p-2 rounded-2xl bg-muted/30">
            <p className="text-[9px] font-bold uppercase text-muted-foreground mb-0.5">Active Gigs</p>
            <p className="text-xs font-semibold">{d.active_orders || 0}</p>
          </div>
        </div>

        <div className="p-3 rounded-2xl bg-primary/5 ring-1 ring-primary/10">
          <p className="text-[9px] font-bold uppercase text-primary/70 mb-1">Live Status</p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-bold text-primary">On Delivery</p>
          </div>
        </div>
      </div>
    </div>
  );
}
