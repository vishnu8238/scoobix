import { Search, MapPin, Eye, Edit3, X } from "lucide-react";
import { type DeliveryZone } from "@/lib/zones-api";

interface ZoneDirectoryItemProps {
  zone: DeliveryZone;
  pointsCount: number;
  onView: (zone: DeliveryZone) => void;
  onEdit: (zone: DeliveryZone) => void;
}

export function ZoneDirectoryItem({ zone, pointsCount, onView, onEdit }: ZoneDirectoryItemProps) {
  return (
    <div className="group relative flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50 transition-all hover:shadow-md hover:ring-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-display text-base font-extrabold text-foreground group-hover:text-primary transition-colors">
              {zone.name}
            </h4>
            <span className="text-[10px] font-bold text-muted-foreground/60">
              #{zone.id.slice(0, 4)}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <MapPin className="h-3 w-3" />
            <span>{pointsCount} Points</span>
          </div>
        </div>
        <div className="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
          {zone.city}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView(zone)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted/50 py-2 text-xs font-bold text-muted-foreground transition hover:bg-primary/10 hover:text-primary active:scale-95"
        >
          <Eye className="h-3.5 w-3.5" />
          View
        </button>
        <button
          onClick={() => onEdit(zone)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Edit
        </button>
      </div>
    </div>
  );
}
