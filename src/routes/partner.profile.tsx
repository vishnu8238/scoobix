import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Store, MapPin, Save, Loader2, Camera } from "lucide-react";
import { PageHeader } from "@/components/cravio/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePartnerRestaurant } from "@/lib/partner-store";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { ImageUploader } from "@/components/cravio/ImageUploader";

export const Route = createFileRoute("/partner/profile")({
  head: () => ({ meta: [{ title: "Scoobix Partner · Restaurant Profile" }] }),
  component: PartnerProfile,
});

function PartnerProfile() {
  const { restaurant, loading, update } = usePartnerRestaurant();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    cuisine: "",
    address: "",
    latitude: null as number | null,
    longitude: null as number | null,
    logo_url: "",
    cover_url: "",
  });

  useEffect(() => {
    if (restaurant) {
      setForm({
        name: restaurant.name || "",
        cuisine: (restaurant as any).cuisine || "",
        address: restaurant.address || "",
        latitude: (restaurant as any).latitude ?? null,
        longitude: (restaurant as any).longitude ?? null,
        logo_url: restaurant.logo_url || "",
        cover_url: restaurant.cover_url || "",
      });
    }
  }, [restaurant]);

  const handleSave = async () => {
    setBusy(true);
    try {
      await update(form);
      toast.success("Profile updated successfully");
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px] pb-32">
      <PageHeader title="Restaurant Profile" subtitle="Public details & location" />

      <div className="mx-4 space-y-6">
        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold">
            <Store className="h-4 w-4 text-primary" /> Basic Information
          </h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Restaurant Name</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="h-11 rounded-2xl bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cuisine Type</Label>
              <Input value={form.cuisine} onChange={e => setForm({ ...form, cuisine: e.target.value })} placeholder="Italian · Pizza · Pasta" className="h-11 rounded-2xl bg-secondary/50" />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold">
            <MapPin className="h-4 w-4 text-primary" /> Authoritative Location
          </h2>
          <LocationPicker 
            latitude={form.latitude} 
            longitude={form.longitude} 
            address={form.address}
            onChange={(lat, lng, addr) => setForm({ ...form, latitude: lat, longitude: lng, address: addr })} 
          />
        </section>

        <section className="space-y-4 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
          <h2 className="flex items-center gap-2 font-display text-base font-extrabold">
            <Camera className="h-4 w-4 text-primary" /> Brand Assets
          </h2>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Logo</Label>
              <ImageUploader type="logo" onChange={(r) => setForm(f => ({ ...f, logo_url: r?.image_url ?? "" }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Cover Banner</Label>
              <ImageUploader type="cover" onChange={(r) => setForm(f => ({ ...f, cover_url: r?.image_url ?? "" }))} />
            </div>
          </div>
        </section>

        <Button 
          onClick={handleSave} 
          disabled={busy}
          className="h-12 w-full rounded-full gradient-primary font-bold text-primary-foreground shadow-glow active:scale-95"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
