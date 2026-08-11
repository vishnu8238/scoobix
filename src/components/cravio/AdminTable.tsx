import type { ReactNode } from "react";

export function DataTable({ 
  columns, 
  rows, 
  selection,
  onSelectionChange
}: { 
  columns: string[]; 
  rows: ReactNode[][];
  selection?: Set<string>;
  onSelectionChange?: (selection: Set<string>) => void;
}) {
  const getRowId = (r: ReactNode[]): string => {
    const first = r[0] as any;
    if (first && first.key) {
      // Heuristic: remove common prefixes to get the raw ID
      return String(first.key).replace(/code|name|owner|rating|comm|mgr|open|status|act|id/, "");
    }
    return "";
  };

  const allIds = rows.map(getRowId).filter(Boolean);
  const allSelected = allIds.length > 0 && selection && selection.size === allIds.length;

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(allIds));
    }
  };

  const toggleOne = (id: string) => {
    if (!onSelectionChange || !selection) return;
    const next = new Set(selection);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            {onSelectionChange && (
              <th className="w-10 py-3 pr-4">
                <input 
                  type="checkbox" 
                  checked={!!allSelected} 
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-border/60 bg-muted/30 accent-primary outline-none ring-1 ring-border/60 focus:ring-primary/40"
                />
              </th>
            )}
            {columns.map((c) => <th key={c} className="py-3 pr-4">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const id = getRowId(r);
            const isSelected = selection?.has(id);
            
            return (
              <tr 
                key={i} 
                className={`border-b border-border/30 last:border-0 transition hover:bg-muted/30 ${isSelected ? "bg-primary/5" : ""}`}
              >
                {onSelectionChange && (
                  <td className="w-10 py-3.5 pr-4">
                    {id && (
                      <input 
                        type="checkbox" 
                        checked={!!isSelected}
                        onChange={() => toggleOne(id)}
                        className="h-4 w-4 rounded border-border/60 bg-muted/30 accent-primary outline-none ring-1 ring-border/60 focus:ring-primary/40"
                      />
                    )}
                  </td>
                )}
                {r.map((cell, j) => <td key={j} className="py-3.5 pr-4">{cell}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const TONE: Record<string, string> = {
  Delivered: "bg-emerald-100 text-emerald-700",
  Active: "bg-emerald-100 text-emerald-700",
  Settled: "bg-emerald-100 text-emerald-700",
  Online: "bg-emerald-100 text-emerald-700",
  "On the way": "bg-sky-100 text-sky-700",
  Preparing: "bg-amber-100 text-amber-700",
  Pending: "bg-amber-100 text-amber-700",
  Placed: "bg-violet-100 text-violet-700",
  Cancelled: "bg-rose-100 text-rose-700",
  Suspended: "bg-rose-100 text-rose-700",
  Offline: "bg-zinc-200 text-zinc-700",
};

export function StatusBadge({ label }: { label: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${TONE[label] ?? "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}
