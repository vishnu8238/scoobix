import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { createGig, type Gig } from "@/lib/gigs-api";
import { toast } from "sonner";

interface CreateGigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGigModal({ isOpen, onClose, onSuccess }: CreateGigModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    startHour: "00",
    startMinute: "00",
    endHour: "02",
    endMinute: "00",
    payout: "300",
    neededPeople: "1",
    completionPercentage: "50",
    city: "",
    zone: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const startTime = new Date(`${formData.date}T${formData.startHour}:${formData.startMinute}:00`).toISOString();
      const endTime = new Date(`${formData.date}T${formData.endHour}:${formData.endMinute}:00`).toISOString();

      await createGig({
        title: `Gig ${formData.startHour}:${formData.startMinute} - ${formData.endHour}:${formData.endMinute}`,
        description: `Gig in ${formData.city || 'unspecified city'}, Zone ${formData.zone || 'unspecified zone'}`,
        reward_amount: Number(formData.payout),
        target_deliveries: 10, // Default target
        start_time: startTime,
        end_time: endTime,
        status: "SCHEDULED",
        zone_id: formData.zone || undefined
      });

      toast.success("Gig created successfully");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to create gig:", error);
      toast.error("Failed to create gig");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md rounded-[2rem] p-8">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-2xl font-black text-emerald-900 dark:text-emerald-400">
            Create New Gig
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Date <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold focus:ring-primary/20"
                required
              />
              <Calendar className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/40 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Start Time <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="HH"
                  value={formData.startHour}
                  onChange={(e) => setFormData({ ...formData, startHour: e.target.value.slice(0, 2) })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                  required
                />
                <span className="font-bold text-muted-foreground">:</span>
                <Input
                  placeholder="MM"
                  value={formData.startMinute}
                  onChange={(e) => setFormData({ ...formData, startMinute: e.target.value.slice(0, 2) })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                End Time <span className="text-rose-500">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="HH"
                  value={formData.endHour}
                  onChange={(e) => setFormData({ ...formData, endHour: e.target.value.slice(0, 2) })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                  required
                />
                <span className="font-bold text-muted-foreground">:</span>
                <Input
                  placeholder="MM"
                  value={formData.endMinute}
                  onChange={(e) => setFormData({ ...formData, endMinute: e.target.value.slice(0, 2) })}
                  className="h-12 rounded-2xl border-border/60 bg-muted/30 text-center font-bold"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Estimated Payout (₹) <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="e.g. 300"
                value={formData.payout}
                onChange={(e) => setFormData({ ...formData, payout: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Needed People <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="1"
                type="number"
                value={formData.neededPeople}
                onChange={(e) => setFormData({ ...formData, neededPeople: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                Percentage to complete gig <span className="text-rose-500">*</span>
              </Label>
              <Input
                placeholder="50"
                type="number"
                value={formData.completionPercentage}
                onChange={(e) => setFormData({ ...formData, completionPercentage: e.target.value })}
                className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                City <span className="text-rose-500">*</span>
              </Label>
              <Select onValueChange={(v) => setFormData({ ...formData, city: v })}>
                <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="city1">City 1</SelectItem>
                  <SelectItem value="city2">City 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Zone <span className="text-rose-500">*</span>
            </Label>
            <Select 
              disabled={!formData.city}
              onValueChange={(v) => setFormData({ ...formData, zone: v })}
            >
              <SelectTrigger className="h-12 rounded-2xl border-border/60 bg-muted/30 font-bold">
                <SelectValue placeholder={formData.city ? "Select zone" : "Select city first"} />
              </SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="zone1">Zone 1</SelectItem>
                <SelectItem value="zone2">Zone 2</SelectItem>
                <SelectItem value="zone3">Zone 3</SelectItem>
                <SelectItem value="zone4">Zone 4</SelectItem>
              </SelectContent>
            </Select>
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
              className="h-12 flex-1 rounded-2xl bg-emerald-900 font-black text-white hover:bg-emerald-800"
            >
              {loading ? "Creating..." : "+ Create Gig"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
