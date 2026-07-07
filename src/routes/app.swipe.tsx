import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Filter, Heart, Star, X, Clock, Sparkles, ShoppingBag } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { allDishes, findDish, restaurants } from "@/lib/mock-data";
import type { Dish } from "@/lib/mock-data";
import { useCart, useAppUI } from "@/lib/stores";
import { useCms } from "@/lib/cms-store";
import { cn, currency } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/app/swipe")({
  head: () => ({
    meta: [
      { title: "Scoobix Swipe · Discover food" },
      { name: "description", content: "Swipe to discover nearby dishes. Right adds to cart, left dismisses." },
    ],
  }),
  component: SwipePage,
});

type VegFilter = "all" | "veg" | "nonveg";

function SwipePage() {
  const { addItem } = useCart();
  const { vegMode } = useAppUI();
  const { dishVegOverrides } = useCms();

  const [restaurantId, setRestaurantId] = useState<string>("all");
  const [vegFilter, setVegFilter] = useState<VegFilter>(vegMode ? "veg" : "all");
  const [filterOpen, setFilterOpen] = useState(false);

  const baseDeck = useMemo(() => {
    let list: Dish[] = allDishes();
    if (restaurantId !== "all") {
      list = list.filter((d) => findDish(d.id)?.restaurant.id === restaurantId);
    }
    list = list.filter((d) => {
      const isVeg = dishVegOverrides[d.id] ?? d.veg ?? false;
      if (vegFilter === "veg") return isVeg;
      if (vegFilter === "nonveg") return !isVeg;
      return true;
    });
    return list;
  }, [restaurantId, vegFilter, dishVegOverrides]);

  const [index, setIndex] = useState(0);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);

  // Reset index when filters change
  const lastKey = useRef("");
  const key = `${restaurantId}|${vegFilter}`;
  if (key !== lastKey.current) {
    lastKey.current = key;
    if (index !== 0) setIndex(0);
  }

  const deck = baseDeck;
  const current = deck[index];
  const next = deck[index + 1];

  // Drag state
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0, dragging: true });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y, dragging: true });
  };
  const onPointerUp = () => {
    if (!startRef.current) return;
    const { x } = drag;
    if (Math.abs(x) > 110) {
      x > 0 ? acceptCurrent("swipe") : rejectCurrent("swipe");
    } else {
      setDrag({ x: 0, y: 0, dragging: false });
    }
    startRef.current = null;
  };

  function acceptCurrent(_src: "swipe" | "button") {
    if (!current) return;
    const ref = findDish(current.id);
    if (ref) {
      const res = addItem({
        dishId: current.id,
        name: current.name,
        image: current.image,
        price: current.price,
        restaurantId: ref.restaurant.id,
        restaurantName: ref.restaurant.name,
        customizations: [],
      });
      if (!res.ok && res.reason === "different-restaurant") {
        toast.error("Cart has items from another restaurant");
      } else {
        toast.success(`${current.name} added`);
        setLiked((p) => [...p, current.id]);
      }
    }
    // animate out then advance
    setDrag({ x: 600, y: 0, dragging: false });
    setTimeout(() => { setIndex((i) => i + 1); setDrag({ x: 0, y: 0, dragging: false }); }, 220);
  }
  function rejectCurrent(_src: "swipe" | "button") {
    if (!current) return;
    setDismissed((p) => [...p, current.id]);
    setDrag({ x: -600, y: 0, dragging: false });
    setTimeout(() => { setIndex((i) => i + 1); setDrag({ x: 0, y: 0, dragging: false }); }, 220);
  }

  const rotate = drag.x / 18;
  const likeOpacity = Math.min(1, Math.max(0, drag.x / 110));
  const nopeOpacity = Math.min(1, Math.max(0, -drag.x / 110));

  const remaining = Math.max(0, deck.length - index);

  return (
    <div className="min-h-svh bg-gradient-to-b from-primary-soft/40 to-background pb-10">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="flex items-center justify-between gap-2">
          <Link to="/app" className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="text-center">
            <p className="eyebrow flex items-center justify-center gap-1"><Sparkles className="h-3 w-3" /> Scoobix Swipe</p>
            <p className="text-[11px] text-muted-foreground">{remaining} dishes left</p>
          </div>
          <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
            <SheetTrigger asChild>
              <button className="grid h-10 w-10 place-items-center rounded-full bg-secondary">
                <Filter className="h-4 w-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[80svh] overflow-y-auto">
              <SheetHeader className="text-left">
                <SheetTitle>Swipe filters</SheetTitle>
                <SheetDescription>Narrow the deck to what you crave.</SheetDescription>
              </SheetHeader>

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Restaurant</h4>
                <div className="flex flex-wrap gap-2">
                  <Chip on={restaurantId === "all"} onClick={() => setRestaurantId("all")}>All restaurants</Chip>
                  {restaurants.map((r) => (
                    <Chip key={r.id} on={restaurantId === r.id} onClick={() => setRestaurantId(r.id)}>{r.name}</Chip>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Food type</h4>
                <div className="grid grid-cols-3 gap-2">
                  <Chip on={vegFilter === "all"} onClick={() => setVegFilter("all")}>All</Chip>
                  <Chip on={vegFilter === "veg"} onClick={() => setVegFilter("veg")}>Veg</Chip>
                  <Chip on={vegFilter === "nonveg"} onClick={() => setVegFilter("nonveg")}>Non veg</Chip>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => { setRestaurantId("all"); setVegFilter("all"); }} className="flex-1 rounded-full">Reset</Button>
                <Button onClick={() => setFilterOpen(false)} className="flex-1 rounded-full gradient-primary text-primary-foreground">Apply</Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="relative mx-auto mt-6 h-[520px] w-[88%] max-w-[400px]">
        {!current ? (
          <EmptyDeck onReset={() => { setIndex(0); setDismissed([]); setLiked([]); }} likedCount={liked.length} />
        ) : (
          <>
            {next && <DishSwipeCard dish={next} stacked />}
            <DishSwipeCard
              key={current.id}
              dish={current}
              transform={`translate3d(${drag.x}px, ${drag.y * 0.3}px, 0) rotate(${rotate}deg)`}
              transition={drag.dragging ? "none" : "transform 220ms ease-out"}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              overlay={
                <>
                  <span
                    style={{ opacity: likeOpacity }}
                    className="absolute left-5 top-6 rotate-[-12deg] rounded-xl border-4 border-primary px-3 py-1 text-lg font-extrabold text-primary"
                  >ADD</span>
                  <span
                    style={{ opacity: nopeOpacity }}
                    className="absolute right-5 top-6 rotate-[12deg] rounded-xl border-4 border-destructive px-3 py-1 text-lg font-extrabold text-destructive"
                  >NOPE</span>
                </>
              }
            />
          </>
        )}
      </div>

      {current && (
        <div className="mx-auto mt-6 flex w-[88%] max-w-[400px] items-center justify-center gap-6">
          <button
            onClick={() => rejectCurrent("button")}
            aria-label="Dismiss"
            className="grid h-16 w-16 place-items-center rounded-full bg-card shadow-card ring-1 ring-border transition active:scale-90"
          >
            <X className="h-7 w-7 text-destructive" strokeWidth={2.8} />
          </button>
          <button
            onClick={() => acceptCurrent("button")}
            aria-label="Add to cart"
            className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow transition active:scale-90"
          >
            <ShoppingBag className="h-7 w-7" strokeWidth={2.6} />
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] uppercase tracking-widest text-muted-foreground">
        Swipe right to add · left to skip · {liked.length} liked · {dismissed.length} skipped
      </p>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border-2 px-3.5 py-1.5 text-xs font-bold transition active:scale-95",
        on ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-muted-foreground",
      )}
    >{children}</button>
  );
}

function DishSwipeCard({
  dish, transform, transition, stacked, overlay,
  onPointerDown, onPointerMove, onPointerUp, onPointerCancel,
}: {
  dish: Dish;
  transform?: string;
  transition?: string;
  stacked?: boolean;
  overlay?: React.ReactNode;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: (e: React.PointerEvent) => void;
}) {
  const ref = findDish(dish.id);
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{
        transform: transform ?? (stacked ? "scale(0.95) translateY(12px)" : undefined),
        transition,
        touchAction: "none",
      }}
      className={cn(
        "absolute inset-0 select-none overflow-hidden rounded-[32px] bg-card shadow-pop ring-1 ring-border/60",
        stacked && "pointer-events-none opacity-90",
      )}
    >
      <img src={dish.image} alt={dish.name} className="h-3/5 w-full object-cover" draggable={false} />
      <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white">
        <Star className="h-3 w-3 fill-yellow-300 text-yellow-300" /> {dish.rating.toFixed(1)}
      </div>
      <span className={cn(
        "absolute left-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded border-[2px] bg-white",
        dish.veg ? "border-success" : "border-destructive",
      )}>
        <span className={cn("h-2 w-2 rounded-full", dish.veg ? "bg-success" : "bg-destructive")} />
      </span>

      <div className="space-y-1.5 p-5">
        <h3 className="font-display text-2xl font-extrabold leading-tight tracking-tight">{dish.name}</h3>
        <p className="text-sm font-medium text-muted-foreground">{ref?.restaurant.name}</p>
        <div className="flex items-center justify-between pt-2">
          <span className="font-display text-2xl font-extrabold text-primary">{currency(dish.price)}</span>
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> {ref?.restaurant.deliveryMins} min
          </span>
        </div>
      </div>

      {overlay}
    </div>
  );
}

function EmptyDeck({ onReset, likedCount }: { onReset: () => void; likedCount: number }) {
  return (
    <div className="absolute inset-0 grid place-items-center rounded-[32px] bg-card p-6 text-center shadow-pop ring-1 ring-border/60">
      <div>
        <span className="grid mx-auto h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
          <Heart className="h-8 w-8" />
        </span>
        <p className="mt-4 font-display text-xl font-extrabold">You've seen it all</p>
        <p className="mt-1 text-sm text-muted-foreground">{likedCount} dish{likedCount === 1 ? "" : "es"} added to cart</p>
        <button onClick={onReset} className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow">Restart deck</button>
      </div>
    </div>
  );
}
