import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/manager/profile")({
  component: ManagerProfile,
});

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, User as UserIcon, Phone, Camera, Save } from "lucide-react";
import { updateManagerProfile } from "@/lib/manager-api";
import { ImageUploader } from "@/components/cravio/ImageUploader";
import type { ImageRef } from "@/lib/image-service";
import { getDisplayName, getInitials } from "@/lib/identity-utils";

function ManagerProfile() {
  const { user, loading: authLoading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setAvatar(user.avatar || "");
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) return toast.error("Name is required");
    setBusy(true);
    try {
      await updateManagerProfile({ name, phone, avatar_url: avatar });
      toast.success("Profile updated successfully");
      window.location.reload(); // Refresh to update store and header
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading && !user) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayName = getDisplayName(user);
  const initials = getInitials(displayName);

  return (
    <div className="mx-auto max-w-[500px] px-5 py-8">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-primary-soft text-2xl font-bold text-primary ring-1 ring-primary/20 shadow-soft">
            {avatar ? (
              <img src={avatar} alt={displayName} className="h-full w-full rounded-3xl object-cover" />
            ) : (
              initials || <UserIcon className="h-10 w-10" />
            )}
          </div>
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight italic uppercase">
          {displayName || "Merchant Manager"}
        </h1>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mt-1">
          {user?.email}
        </p>
      </div>

      <div className="space-y-6 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Profile Photo</Label>
          <ImageUploader
            type="logo"
            label="Avatar"
            value={avatar ? ({ image_url: avatar } as ImageRef) : null}
            onChange={(ref) => setAvatar(ref?.image_url ?? "")}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Full Name</Label>
          <div className="relative">
            <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/50" />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 rounded-2xl pl-10 bg-secondary/30"
              placeholder="Your full name"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground ml-1">Phone Number</Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground/50" />
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="h-12 rounded-2xl pl-10 bg-secondary/30"
              placeholder="+91 98xxxxxx00"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          disabled={busy}
          className="h-12 w-full rounded-2xl gradient-primary font-bold text-primary-foreground shadow-glow mt-2"
        >
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Profile
        </Button>
      </div>
    </div>
  );
}

