import { useMemo, useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import type { Dish } from "@/lib/mock-data";
import { findDish } from "@/lib/mock-data";
import { addonsForDish } from "@/lib/insforge";
import { useCart } from "@/lib/stores";
import { currency, cn } from "@/lib/format";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

const SIZES = [
  { id: "regular", label: "Regular", delta: 0 },
  { id: "large",   label: "Large",   delta: 2.5 },
  { id: "xl",      label: "Sharing", delta: 5.0 },
];
const DEFAULT_EXTRAS = [
  { id: "cheese", label: "Extra cheese", delta: 1.5 },
  { id: "avocado", label: "Avocado", delta: 2.0 },
  { id: "egg", label: "Extra protein", delta: 3.0 },
];
const SPICE = ["Mild", "Medium", "Hot", "Extra hot"];

export function CustomizationSheet({
  open, onOpenChange, dish,
}: { open: boolean; onOpenChange: (o: boolean) => void; dish: Dish }) {
  const ref = findDish(dish.id);
  const { addItem } = useCart();
  const [size, setSize] = useState("regular");
  const [extras, setExtras] = useState<string[]>([]);
  const [spice, setSpice] = useState("Medium");
  const [qty, setQty] = useState(1);

  const sizeObj = SIZES.find((s) => s.id === size)!;
  const [EXTRAS, setEXTRAS] = useState(DEFAULT_EXTRAS);

  useEffect(() => {
    addonsForDish(dish.id).then((fromBackend) => {
      if (fromBackend && fromBackend.length > 0) {
        setEXTRAS(fromBackend.map((a: any) => ({ id: a.id, label: a.name, delta: a.price })));
      }
    });
  }, [dish.id]);

  const extrasObj = EXTRAS.filter((e) => extras.includes(e.id));
  const unit = useMemo(() => dish.price + sizeObj.delta + extrasObj.reduce((s, e) => s + e.delta, 0), [dish.price, sizeObj, extrasObj]);

  const handleAdd = () => {
    if (!ref) return;
    const customizations = [
      sizeObj.label !== "Regular" ? `Size: ${sizeObj.label}` : null,
      ...extrasObj.map((e) => `+ ${e.label}`),
      `Spice: ${spice}`,
    ].filter(Boolean) as string[];
    const res = addItem({
      dishId: dish.id,
      name: dish.name,
      image: dish.image,
      price: unit,
      restaurantId: ref.restaurant.id,
      restaurantName: ref.restaurant.name,
      customizations,
    }, qty);
    if (!res.ok && res.reason === "different-restaurant") {
      toast.error("Cart belongs to another restaurant", { description: "Clear it first to add from a new one." });
      return;
    }
    toast.success(`Added ${qty} × ${dish.name}`, { description: ref.restaurant.name });
    onOpenChange(false);
    setQty(1); setExtras([]); setSize("regular"); setSpice("Medium");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88svh] overflow-y-auto p-0">
        <div className="relative">
          <img src={dish.image} alt="" className="h-44 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="px-5 pb-6 -mt-6 relative">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-xl">{dish.name}</SheetTitle>
            <SheetDescription>{dish.description}</SheetDescription>
          </SheetHeader>

          <Section title="Size">
            <div className="grid grid-cols-3 gap-2">
              {SIZES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSize(s.id)}
                  className={cn(
                    "rounded-2xl border-2 p-3 text-left transition",
                    size === s.id ? "border-primary bg-primary-soft" : "border-border bg-card",
                  )}
                >
                  <div className="text-sm font-bold">{s.label}</div>
                  <div className="text-xs text-muted-foreground">{s.delta === 0 ? "Included" : `+ ${currency(s.delta)}`}</div>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Add-ons">
            <div className="space-y-2">
              {EXTRAS.map((e) => {
                const checked = extras.includes(e.id);
                return (
                  <button
                    key={e.id}
                    onClick={() => setExtras((p) => checked ? p.filter((x) => x !== e.id) : [...p, e.id])}
                    className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left"
                  >
                    <span className="text-sm font-semibold">{e.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">+ {currency(e.delta)}</span>
                      <span className={cn("grid h-5 w-5 place-items-center rounded-md border-2", checked ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                        {checked && "✓"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Spice level">
            <div className="grid grid-cols-4 gap-2">
              {SPICE.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpice(s)}
                  className={cn(
                    "rounded-full border-2 px-2 py-1.5 text-xs font-semibold transition",
                    spice === s ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground",
                  )}
                >{s}</button>
              ))}
            </div>
          </Section>

          <div className="mt-6 flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="grid h-8 w-8 place-items-center rounded-full bg-card shadow-soft"><Minus className="h-4 w-4" /></button>
              <span className="w-6 text-center text-sm font-bold">{qty}</span>
              <button onClick={() => setQty((q) => q + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-card shadow-soft"><Plus className="h-4 w-4" /></button>
            </div>
            <Button onClick={handleAdd} className="h-12 flex-1 rounded-full gradient-primary text-base font-bold text-primary-foreground shadow-glow hover:opacity-95">
              Add · {currency(unit * qty)}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}