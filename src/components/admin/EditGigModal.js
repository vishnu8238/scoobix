import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Edit2, AlertTriangle, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { updateGig } from "@/lib/gigs-api";
export function EditGigModal({ gig, isOpen, onClose, onSuccess, onDelete }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        reward_amount: 0,
        target_deliveries: 0,
        start_time: "",
        end_time: "",
        capacity: 0,
    });
    useEffect(() => {
        if (gig && isOpen) {
            const startT = gig.start_time?.includes('T') ? gig.start_time.split('T')[1].substring(0, 5) : "09:00";
            const endT = gig.end_time?.includes('T') ? gig.end_time.split('T')[1].substring(0, 5) : "18:00";
            setFormData({
                title: gig.title || "",
                description: gig.description || "",
                reward_amount: gig.reward_amount || gig.payout || 0,
                target_deliveries: gig.target_deliveries || 10,
                start_time: startT,
                end_time: endT,
                capacity: gig.capacity || 50,
            });
        }
    }, [gig, isOpen]);
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!gig)
            return;
        // Safety: payout must be non-negative for enrolled gigs
        if (gig.enrolled_count > 0 && formData.reward_amount < 0) {
            toast.error("Payout cannot be negative for gigs with active enrollments");
            return;
        }
        // Safety: capacity cannot be less than enrollment
        if (formData.capacity < (gig.enrolled_count || 0)) {
            toast.error(`Capacity cannot be less than current enrollment (${gig.enrolled_count})`);
            return;
        }
        setLoading(true);
        try {
            const todayStr = (gig.start_time || new Date().toISOString()).split('T')[0];
            const payload = {
                ...formData,
                start_time: `${todayStr}T${formData.start_time}:00Z`,
                end_time: `${todayStr}T${formData.end_time}:00Z`,
                payout: formData.reward_amount // Authoritative field
            };
            await updateGig(gig.id, payload);
            toast.success("Gig updated successfully");
            onSuccess();
            onClose();
        }
        catch (err) {
            toast.error(err.message || "Failed to update gig");
        }
        finally {
            setLoading(false);
        }
    };
    if (!gig)
        return null;
    return (<Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl ring-1 ring-border/40">
        <DialogHeader className="p-8 pb-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="rounded-2xl bg-amber-100 p-3 dark:bg-amber-950/50">
              <Edit2 className="h-6 w-6 text-amber-600 dark:text-amber-400"/>
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Edit Gig Details</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground/60">
                Updating #{gig.id.slice(0, 8).toUpperCase()}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-8 pt-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Gig Title</label>
                <input required value={formData.title} onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))} className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"/>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Start Time</label>
                  <input type="time" required value={formData.start_time} onChange={e => setFormData(prev => ({ ...prev, start_time: e.target.value }))} className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"/>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">End Time</label>
                  <input type="time" required value={formData.end_time} onChange={e => setFormData(prev => ({ ...prev, end_time: e.target.value }))} className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"/>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Payout (₹)</label>
                <input type="number" required value={formData.reward_amount} onChange={e => setFormData(prev => ({ ...prev, reward_amount: parseInt(e.target.value) }))} className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"/>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Rider Capacity</label>
                <input type="number" required value={formData.capacity} onChange={e => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) }))} className="w-full h-12 px-4 bg-muted/30 rounded-2xl ring-1 ring-border/60 outline-none focus:ring-primary/40 font-bold text-sm"/>
              </div>
            </div>
          </div>

          {gig.enrolled_count > 0 && (<div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/20 dark:ring-amber-900/40">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0"/>
                <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                  This gig has {gig.enrolled_count} active enrollments. Payout edits must be non-negative and capacity cannot be reduced below current enrollment.
                </p>
              </div>
            </div>)}

          <DialogFooter className="pt-6 border-t border-border/40 gap-3">
            {onDelete && (<button type="button" onClick={() => onDelete(gig)} className="mr-auto flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-600 hover:text-white transition active:scale-95">
                {gig.enrolled_count > 0 ? <XCircle className="h-4 w-4"/> : <Trash2 className="h-4 w-4"/>}
                {gig.enrolled_count > 0 ? "Cancel Gig" : "Delete Gig"}
              </button>)}
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-2xl text-xs font-black bg-muted hover:bg-muted/80 transition">
              Close
            </button>
            <button type="submit" disabled={loading} className="px-8 py-3 rounded-2xl text-xs font-black bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition disabled:opacity-50 active:scale-95">
              {loading ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save Changes"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>);
}
