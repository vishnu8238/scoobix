/** Permanent, readable restaurant ID chip (SCOO-000001). */
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { ensureRestaurantCode } from "@/lib/restaurant-id";

export function RestaurantIdBadge({
  restaurant,
  className = "",
}: {
  restaurant?: { id: string; code?: string | null } | null;
  className?: string;
}) {
  const [code, setCode] = useState(restaurant?.code ?? "");

  useEffect(() => {
    if (!restaurant?.id) { setCode(""); return; }
    if (restaurant.code) { setCode(restaurant.code); return; }
    let cancelled = false;
    void ensureRestaurantCode(restaurant).then((c) => { if (!cancelled) setCode(c); });
    return () => { cancelled = true; };
  }, [restaurant?.id, restaurant?.code]);

  if (!code) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-wider text-primary ${className}`}>
      <Hash className="h-3 w-3" strokeWidth={3} />
      {code}
    </span>
  );
}
