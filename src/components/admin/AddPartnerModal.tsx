import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createRecord } from "@/lib/insforge-crud";
import { newUuid } from "@/lib/orders-api";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface AddPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPartnerModal({ isOpen, onClose, onSuccess }: AddPartnerModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    vehicle_type: "bike",
    vehicle_number: "",
    city: "Vadodara"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const userId = newUuid();
      const driverId = newUuid();

      // 1. Create User
      const user = await createRecord("users", {
        id: userId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        role: "rider"
      });

      if (!user) throw new Error("Failed to create user record");

      // 2. Create Driver/Partner
      const driver = await createRecord("drivers", {
        id: driverId,
        user_id: userId,
        vehicle_type: formData.vehicle_type,
        vehicle_number: formData.vehicle_number,
        phone: formData.phone,
        online_status: false,
        verification_status: "PENDING",
        city: formData.city
      });

      if (driver) {
        toast.success("Delivery partner added successfully");
        onSuccess();
        onClose();
        setFormData({
          name: "",
          email: "",
          phone: "",
          vehicle_type: "bike",
          vehicle_number: "",
          city: "Vadodara"
        });
      } else {
        throw new Error("Failed to create driver record");
      }
    } catch (error: any) {
      console.error("Failed to add partner:", error);
      toast.error(error.message || "Failed to add partner");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[2rem] p-8">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-black text-primary">
            Add Delivery Partner
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Full Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Email <span className="text-rose-500">*</span>
              </Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Phone <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Vehicle Type
              </Label>
              <Select onValueChange={(v) => setFormData({ ...formData, vehicle_type: v })} defaultValue={formData.vehicle_type}>
                <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="scooter">Scooter</SelectItem>
                  <SelectItem value="cycle">Cycle</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Vehicle Number
              </Label>
              <Input
                value={formData.vehicle_number}
                onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                placeholder="e.g. GJ06AB1234"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-12 flex-1 rounded-2xl border-border/60 font-black"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="h-12 flex-1 rounded-2xl bg-primary font-black text-white hover:opacity-90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Partner"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
