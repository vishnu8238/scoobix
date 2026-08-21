import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Loader2, Upload, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { createGig, updateGig, fetchGigs } from "@/lib/gigs-api";
import { fetchCities, fetchZones } from "@/lib/zones-api";
import { cn } from "@/lib/utils";

interface ImportGigsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ImportGigsModal({ isOpen, onClose, onSuccess }: ImportGigsModalProps) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [validationResults, setValidationResults] = useState<any[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const rows = text.split("\n").map(line => line.split(",").map(cell => cell.trim()));
      
      // Basic CSV parser (assuming Scoobix format)
      // Headers: id, title, description, payout, capacity, start_time, end_time, city_id, zone_id
      const headers = rows[0];
      const data = rows.slice(1).filter(r => r.length > 1).map(r => {
        const obj: any = {};
        headers.forEach((h, i) => {
          obj[h.toLowerCase().replace(/ /g, "_")] = r[i];
        });
        return obj;
      });

      // Validation
      const cities = await fetchCities();
      const zones = await fetchZones();
      
      const results = await Promise.all(data.map(async (item) => {
        const errors = [];
        const cityValid = cities.some(c => c.id === item.city_id);
        const zoneValid = zones.some(z => z.id === item.zone_id);
        
        if (!item.title) errors.push("Title required");
        if (!cityValid) errors.push("Invalid City ID");
        if (!zoneValid) errors.push("Invalid Zone ID");
        if (isNaN(Number(item.payout)) || Number(item.payout) < 0) errors.push("Invalid Payout");
        
        let type = "new";
        if (item.id) {
          const existing = await fetchGigs({ id: item.id });
          if (existing.length > 0) {
            type = "update";
            const enrollment = (existing[0] as any).enrolled_count || 0;
            if (Number(item.capacity) < enrollment) errors.push(`Capacity < Enrollment (${enrollment})`);
          }
        }

        return { ...item, type, errors, isValid: errors.length === 0 };
      }));

      setParsedData(data);
      setValidationResults(results);
      setStep("preview");
    } catch (err: any) {
      toast.error("Failed to parse file: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const validItems = validationResults.filter(r => r.isValid);
    if (validItems.length === 0) {
      toast.error("No valid items to import");
      return;
    }

    setLoading(true);
    try {
      let created = 0;
      let updated = 0;

      for (const item of validItems) {
        if (item.type === "update") {
          await updateGig(item.id, item);
          updated++;
        } else {
          await createGig(item);
          created++;
        }
      }

      toast.success(`Import complete: ${created} created, ${updated} updated`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Import failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl ring-1 ring-border/40">
        <DialogHeader className="p-8 pb-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="rounded-2xl bg-blue-100 p-3 dark:bg-blue-950/50">
              <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-black tracking-tight">Import Gigs</DialogTitle>
              <DialogDescription className="text-sm font-bold text-muted-foreground/60">
                Bulk upload delivery slots using CSV/Excel
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 pt-6">
          {step === "upload" ? (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-border/60 rounded-[2rem] p-12 bg-muted/20">
              <Upload className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-sm font-bold text-muted-foreground mb-6">Select a CSV file matching the Scoobix format</p>
              <input 
                type="file" 
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden" 
                id="gig-import-file" 
              />
              <label 
                htmlFor="gig-import-file"
                className="px-8 py-3 rounded-2xl text-xs font-black bg-primary text-white cursor-pointer hover:bg-primary/90 transition active:scale-95"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Choose File"}
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="max-h-[400px] overflow-y-auto rounded-2xl border border-border/60">
                <table className="w-full text-left text-[10px] font-bold">
                  <thead className="sticky top-0 bg-card border-b border-border/60">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Title</th>
                      <th className="p-3">City/Zone</th>
                      <th className="p-3">Payout</th>
                      <th className="p-3">Capacity</th>
                      <th className="p-3">Errors</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {validationResults.map((r, i) => (
                      <tr key={i} className={cn(!r.isValid && "bg-rose-50/50 dark:bg-rose-950/10")}>
                        <td className="p-3">
                          {r.type === "new" ? (
                            <span className="text-emerald-600">[NEW]</span>
                          ) : (
                            <span className="text-blue-600">[UPDATE]</span>
                          )}
                        </td>
                        <td className="p-3">{r.title}</td>
                        <td className="p-3">{r.city_id} / {r.zone_id}</td>
                        <td className="p-3">₹{r.payout}</td>
                        <td className="p-3">{r.capacity}</td>
                        <td className="p-3">
                          {r.errors.length > 0 ? (
                            <div className="flex items-center gap-1 text-rose-600">
                              <AlertCircle className="h-3 w-3" />
                              {r.errors[0]}
                            </div>
                          ) : (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-muted/30 p-4">
                <div className="flex gap-4">
                  <div className="text-xs font-black">
                    <span className="text-emerald-600">{validationResults.filter(r => r.isValid).length}</span> Valid
                  </div>
                  <div className="text-xs font-black">
                    <span className="text-rose-600">{validationResults.filter(r => !r.isValid).length}</span> Invalid
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setStep("upload")}
                    className="px-6 py-2 rounded-xl text-[10px] font-black bg-muted hover:bg-muted/80 transition"
                  >
                    Back
                  </button>
                  <button 
                    onClick={handleImport}
                    disabled={loading || validationResults.filter(r => r.isValid).length === 0}
                    className="px-6 py-2 rounded-xl text-[10px] font-black bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm Import"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
