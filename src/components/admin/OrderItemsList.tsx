import { ShoppingBag, Tag, ChevronDown, ListFilter } from "lucide-react";
import { formatPrice } from "@/lib/format";

export function OrderItemsList({ items }: { items: any[] }) {
  if (!items || items.length === 0) return (
    <div className="rounded-3xl bg-muted/30 p-8 flex flex-col items-center justify-center text-center">
      <ShoppingBag className="h-10 w-10 text-muted-foreground/40 mb-3" />
      <p className="text-sm font-bold text-muted-foreground">No items in this order</p>
    </div>
  );

  return (
    <div className="rounded-3xl bg-card shadow-soft ring-1 ring-border/60 overflow-hidden">
      <div className="p-5 border-b border-border/40 bg-muted/10 flex items-center justify-between">
        <h3 className="font-display font-extrabold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          Order Items
        </h3>
        <span className="text-[10px] font-bold bg-muted px-2 py-1 rounded-lg">
          {items.reduce((acc, i) => acc + (i.quantity || 1), 0)} Items
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground border-b border-border/40">
              <th className="px-5 py-3 font-bold uppercase tracking-wider">Item</th>
              <th className="px-5 py-3 font-bold uppercase tracking-wider text-center">Qty</th>
              <th className="px-5 py-3 font-bold uppercase tracking-wider text-right">Price</th>
              <th className="px-5 py-3 font-bold uppercase tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {items.map((item, idx) => (
              <tr key={idx} className="hover:bg-muted/10 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex-shrink-0" />
                    <div>
                      <p className="font-bold text-sm">{item.name || item.dish_name || "Unknown Item"}</p>
                      {item.customizations && item.customizations.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.customizations.map((c: string, i: number) => (
                            <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/5 text-primary/80 font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                      {item.instructions && (
                        <p className="text-[10px] text-muted-foreground mt-1 italic italic">
                          "{item.instructions}"
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-center font-bold">
                  {item.quantity || 1}
                </td>
                <td className="px-5 py-4 text-right font-medium text-muted-foreground">
                  {formatPrice(item.price)}
                </td>
                <td className="px-5 py-4 text-right font-bold">
                  {formatPrice((item.price || 0) * (item.quantity || 1))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function OrderFinancials({ financials }: { financials: any }) {
  return (
    <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border/60">
      <h3 className="font-display font-extrabold flex items-center gap-2 mb-4">
        <Tag className="h-5 w-5 text-primary" />
        Financial Breakdown
      </h3>

      <div className="space-y-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-medium">Items Subtotal</span>
          <span className="font-bold">{formatPrice(financials.subtotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-medium">Delivery Fee</span>
          <span className="font-bold">{formatPrice(financials.deliveryFee)}</span>
        </div>
        {financials.discount > 0 && (
          <div className="flex justify-between text-xs text-emerald-600">
            <span className="font-medium">Discount</span>
            <span className="font-bold">-{formatPrice(financials.discount)}</span>
          </div>
        )}
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground font-medium">Taxes & Fees</span>
          <span className="font-bold">{formatPrice(financials.taxes)}</span>
        </div>
        
        <div className="h-px bg-border/40 my-2" />
        
        <div className="flex justify-between text-sm">
          <span className="font-extrabold">Grand Total</span>
          <span className="font-extrabold text-primary text-lg">{formatPrice(financials.totalPrice)}</span>
        </div>

        <div className="mt-6 pt-6 border-t border-border/40">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">Platform Operations</p>
          <div className="space-y-2">
            {financials.deductions.map((d: any) => (
              <div key={d.label} className="flex justify-between text-[11px]">
                <span className="text-muted-foreground">{d.label}</span>
                <span className="font-semibold text-rose-500">-{formatPrice(d.value)}</span>
              </div>
            ))}
            <div className="flex justify-between text-xs pt-2 font-bold text-primary">
              <span>Platform Net</span>
              <span>{formatPrice(financials.netToPlatform)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
