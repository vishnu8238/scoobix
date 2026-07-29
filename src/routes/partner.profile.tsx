import { createFileRoute } from "@tanstack/react-router";
import { partnerRestaurant } from "@/lib/role-data";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { RestaurantIdBadge } from "@/components/cravio/RestaurantIdBadge";
import { RelationshipManagerCard } from "@/components/cravio/RelationshipManagerCard";
import { MapPin, Phone, Clock, Star, Tag, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/partner/profile")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Profile" }] }),
  component: PartnerProfile,
});

const HOURS = [
  ["Mon", "11:00 – 23:00"], ["Tue", "11:00 – 23:00"], ["Wed", "11:00 – 23:00"],
  ["Thu", "11:00 – 23:00"], ["Fri", "11:00 – 00:00"], ["Sat", "10:00 – 00:00"], ["Sun", "10:00 – 22:00"],
] as const;

function PartnerProfile() {
  const { restaurant } = usePartnerRestaurant();
  return (
    <div className="animate-fade-up pb-8">
      <div className="relative h-56 w-full overflow-hidden">
        <img src={partnerRestaurant.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-4 left-5 right-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">Restaurant Profile</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight">{restaurant?.name ?? user?.name ?? "Your restaurant"}</h1>
          <p className="mt-1 text-sm text-white/80">{partnerRestaurant.cuisine}</p>
        </div>
      </div>

      <div className="space-y-5 px-5 pt-5">
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border/60">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Restaurant ID</p>
            <div className="mt-1.5"><RestaurantIdBadge restaurant={restaurant} /></div>
          </div>
        </div>

        <RelationshipManagerCard restaurant={restaurant} />

        <div className="grid grid-cols-3 gap-3 rounded-3xl bg-card p-4 shadow-card ring-1 ring-border/60">
          <Stat icon={Star} label="Rating" value={partnerRestaurant.rating.toFixed(1)} />
          <Stat icon={Tag} label="Reviews" value={partnerRestaurant.reviews.toLocaleString()} />
          <Stat icon={Clock} label="Avg time" value={`${partnerRestaurant.deliveryMins}m`} />
        </div>

        <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="font-display text-lg font-bold">Details</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li className="flex items-start gap-3"><MapPin className="h-4 w-4 mt-0.5 text-primary" /> {restaurant?.address ?? "Address not set"}</li>
            <li className="flex items-start gap-3"><Phone className="h-4 w-4 mt-0.5 text-primary" /> +1 555 0144</li>
          </ul>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold">Gallery</h2>
            <button className="flex items-center gap-1.5 text-[11px] font-bold text-primary"><ImageIcon className="h-3.5 w-3.5" /> Add photo</button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {partnerRestaurant.menu.slice(0, 6).map((d) => (
              <img key={d.id} src={d.image} alt="" className="aspect-square w-full rounded-2xl object-cover" />
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="font-display text-lg font-bold">Opening hours</h2>
          <ul className="mt-3 space-y-2">
            {HOURS.map(([day, hours]) => (
              <li key={day} className="flex justify-between text-sm">
                <span className="font-medium">{day}</span>
                <span className="text-muted-foreground">{hours}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="font-display text-lg font-bold">Active offers</h2>
          <div className="mt-3 space-y-2">
            {[partnerRestaurant.offer ?? "20% OFF over $25", "Free dessert with pasta", "Lunch combo $14.99"].map((o, i) => (
              <div key={i} className="flex items-center justify-between rounded-2xl bg-primary/5 px-4 py-3 ring-1 ring-primary/15">
                <span className="text-sm font-bold text-primary">{o}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Live</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="text-center">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 font-display text-base font-extrabold">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}
