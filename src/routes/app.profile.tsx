import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";
import { isAuthResolving } from "@/lib/auth-utils";
import { PageHeader } from "@/components/cravio/PageHeader";
import { getInitials } from "@/lib/identity-utils";
import { RoleGuard } from "@/components/cravio/RoleGuard";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patchRecord } from "@/lib/insforge-crud";
import { toast } from "sonner";
import { cn } from "@/lib/format";
import { MapPin, Plus, Trash2, Check, Smartphone, User, Mail, Loader2, Navigation } from "lucide-react";
import { fetchAddresses, saveAddress, removeAddress, setDefaultAddress, type Address } from "@/lib/addresses-api";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { LocationPicker } from "@/components/maps/LocationPicker";

export const Route = createFileRoute("/app/profile")({
  component: AppProfile,
});

function AppProfile() {
  const { user, loading, authState } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addrSheet, setAddrSheet] = useState<{ open: boolean; edit?: Address } | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadAddresses();
    }
  }, [user?.id]);

  useEffect(() => {
    if (!loading && !isAuthResolving(authState) && !user) {
      window.location.replace("/login?portal=customer");
    }
  }, [user, loading, authState]);

  const loadAddresses = async () => {
    if (!user?.id) return;
    try {
      const data = await fetchAddresses(user.id);
      setAddresses(data);
    } catch (e) {
      console.error("Failed to load addresses", e);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    if (!name.trim()) return toast.error("Name is required");
    if (!/^\d{10}$/.test(phone.trim())) return toast.error("Enter a valid 10-digit phone number");

    setSaving(true);
    try {
      await patchRecord("users", user.id, { name: name.trim(), phone: phone.trim() });
      toast.success("Profile updated");
      setEditing(false);
      // Wait for AuthStore to sync name if needed, or just let it re-resolve
    } catch (e) {
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RoleGuard allow="customer">
      <div className="pb-32 bg-background min-h-svh">
        <PageHeader title="Profile" back />
        
        <div className="p-4 space-y-6 max-w-lg mx-auto w-full animate-fade-up">
          {/* Identity Card */}
          <div className="flex flex-col gap-4 p-6 bg-card rounded-3xl border border-border/60 shadow-soft">
            <div className="flex items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center text-primary font-bold text-2xl uppercase shadow-inner">
                {getInitials(user?.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate tracking-tight">{user?.name || "Scoobix Customer"}</h2>
                <div className="flex items-center gap-1.5 text-muted-foreground mt-0.5">
                  <Mail className="h-3.5 w-3.5" />
                  <p className="text-xs truncate font-medium">{user?.email}</p>
                </div>
              </div>
            </div>
            
            {!editing ? (
              <div className="grid grid-cols-1 gap-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-secondary/30 border border-border/40">
                  <div className="flex items-center gap-3">
                    <Smartphone className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{user?.phone || "No phone linked"}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setName(user?.name || ""); setPhone(user?.phone || ""); setEditing(true); }} className="text-[10px] font-black uppercase tracking-widest text-primary">Edit</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Name</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" className="h-11 rounded-2xl bg-secondary/50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Phone Number</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" className="h-11 rounded-2xl bg-secondary/50" />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={() => setEditing(false)} variant="outline" className="flex-1 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest">Cancel</Button>
                  <Button onClick={handleSaveProfile} disabled={saving} className="flex-1 rounded-2xl h-11 text-xs font-bold uppercase tracking-widest shadow-glow">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Addresses Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Saved Addresses
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setAddrSheet({ open: true })} 
                className="h-8 rounded-full px-3 text-[10px] font-black uppercase tracking-widest text-primary bg-primary-soft hover:bg-primary-soft/80"
              >
                <Plus className="mr-1 h-3 w-3" /> Add New
              </Button>
            </div>

            <div className="space-y-3">
              {loadingAddresses ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : addresses.length === 0 ? (
                <div className="p-8 text-center bg-card rounded-3xl border border-dashed border-border/60">
                  <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-sm text-muted-foreground font-medium">No addresses saved yet.</p>
                </div>
              ) : (
                addresses.map((addr) => (
                  <div key={addr.id} className="group relative p-4 bg-card rounded-3xl border border-border/60 shadow-soft transition-all hover:ring-2 hover:ring-primary/20">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 p-2 rounded-xl", addr.is_default ? "bg-primary text-white" : "bg-secondary/60 text-muted-foreground")}>
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 pr-10">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold">{addr.label}</span>
                          {addr.is_default && <span className="text-[9px] font-black uppercase tracking-tighter bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">Default</span>}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1 line-clamp-2">{addr.address}</p>
                      </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!addr.is_default && (
                        <button onClick={() => setDefaultAddress(addr.id, user!.id).then(loadAddresses)} className="p-2 rounded-xl bg-primary-soft text-primary hover:bg-primary/20">
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setAddrSheet({ open: true, edit: addr })} className="p-2 rounded-xl bg-secondary/80 text-muted-foreground hover:bg-secondary">
                        <User className="h-3.5 w-3.5" /> {/* Using User as Edit icon placeholder or just text */}
                      </button>
                      <button onClick={() => removeAddress(addr.id).then(loadAddresses)} className="p-2 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <AddressFormSheet 
          open={!!addrSheet?.open} 
          onClose={() => setAddrSheet(null)} 
          onSaved={loadAddresses}
          edit={addrSheet?.edit}
          userId={user?.id || ""}
        />
      </div>
    </RoleGuard>
  );
}

function AddressFormSheet({ open, onClose, onSaved, edit, userId }: { open: boolean; onClose: () => void; onSaved: () => void; edit?: Address; userId: string }) {
  const [label, setLabel] = useState(edit?.label || "");
  const [addressLine, setAddressLine] = useState(edit?.address || "");
  const [lat, setLat] = useState<number | null>(edit?.latitude || null);
  const [lng, setLng] = useState<number | null>(edit?.longitude || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (edit) {
      setLabel(edit.label);
      setAddressLine(edit.address);
      setLat(edit.latitude);
      setLng(edit.longitude);
    } else {
      setLabel("");
      setAddressLine("");
      setLat(null);
      setLng(null);
    }
  }, [edit, open]);

  const handleSave = async () => {
    if (!label.trim()) return toast.error("Label is required (e.g. Home, Office)");
    if (!addressLine.trim()) return toast.error("Full address is required");

    setSaving(true);
    try {
      await saveAddress({
        id: edit?.id,
        user_id: userId,
        label: label.trim(),
        address: addressLine.trim(),
        latitude: lat,
        longitude: lng,
      });
      toast.success(edit ? "Address updated" : "Address saved");
      onSaved();
      onClose();
    } catch (e) {
      toast.error("Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={o => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-w-lg mx-auto p-0 border-none shadow-2xl">
        <SheetHeader className="p-6 border-b border-border/60 text-left">
          <SheetTitle className="font-display text-xl font-extrabold italic uppercase tracking-tight">{edit ? "Edit Address" : "Add New Address"}</SheetTitle>
          <SheetDescription className="text-xs font-medium uppercase tracking-widest text-muted-foreground/70">Secure your delivery location</SheetDescription>
        </SheetHeader>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh] no-scrollbar pb-32">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Address Label</Label>
              <div className="flex flex-wrap gap-2">
                {["Home", "Work", "Other"].map(l => (
                  <button 
                    key={l}
                    onClick={() => setLabel(l)}
                    className={cn(
                      "px-4 py-2 rounded-2xl text-xs font-bold transition-all border",
                      label === l ? "bg-primary text-white border-primary shadow-glow" : "bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/60"
                    )}
                  >
                    {l}
                  </button>
                ))}
                {!["Home", "Work"].includes(label) && label !== "" && (
                  <button className="px-4 py-2 rounded-2xl text-xs font-bold bg-primary text-white border-primary shadow-glow">
                    {label}
                  </button>
                )}
              </div>
              <Input 
                value={["Home", "Work"].includes(label) ? "" : label} 
                onChange={e => setLabel(e.target.value)} 
                placeholder="Or type custom label..." 
                className="h-11 rounded-2xl bg-secondary/50 mt-2" 
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Address</Label>
              <Input value={addressLine} onChange={e => setAddressLine(e.target.value)} placeholder="Flat/House No, Building, Street" className="h-11 rounded-2xl bg-secondary/50" />
            </div>

            <div className="space-y-3">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Pin Location (Optional)</Label>
              <LocationPicker 
                latitude={lat} 
                longitude={lng} 
                onChange={(newLat, newLng, newAddr) => {
                  setLat(newLat);
                  setLng(newLng);
                  if (newAddr && !addressLine) setAddressLine(newAddr);
                }} 
              />
              <p className="text-[10px] text-muted-foreground leading-relaxed italic opacity-70"> Coordinates help our riders find you faster. You can still enter the address manually.</p>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-6 bg-card/80 backdrop-blur-md border-t border-border/60">
          <Button onClick={handleSave} disabled={saving} className="w-full h-14 rounded-2xl text-sm font-bold uppercase tracking-widest shadow-glow">
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : edit ? "Update Address" : "Save Address"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
