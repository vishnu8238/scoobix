import { useEffect, useState } from "react";
import type { OrderStatus } from "@/lib/stores";

/**
 * Stylized map: SVG with gradient background, road grid, curved route, and a
 * driver pin that animates along the route based on order status progress.
 */
export function MapStylized({ status }: { status: OrderStatus }) {
  // progress 0..1
  const target =
    status === "PLACED" ? 0.05 :
    status === "PREPARING" ? 0.15 :
    status === "PICKED_UP" ? 0.4 :
    status === "ON_THE_WAY" ? 0.75 :
    status === "DELIVERED" ? 1 :
    0;

  const [p, setP] = useState(target);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = p;
    const dur = 1400;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      setP(from + (target - from) * t);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  // route path: cubic curve from restaurant to home
  // points expressed in a 400x300 viewport
  const path = "M 60 230 C 130 120, 220 280, 340 70";

  // approximate position along the path
  const pt = pointOnCubic(60, 230, 130, 120, 220, 280, 340, 70, p);

  return (
    <div className="relative h-[260px] w-full overflow-hidden rounded-3xl shadow-card ring-1 ring-border/60">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id="mapbg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="oklch(0.95 0.04 148)" />
            <stop offset="100%" stopColor="oklch(0.97 0.01 200)" />
          </linearGradient>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="oklch(0.9 0.01 200)" strokeWidth="0.4" />
          </pattern>
        </defs>
        <rect width="400" height="300" fill="url(#mapbg)" />
        <rect width="400" height="300" fill="url(#grid)" />
        {/* "roads" */}
        <path d="M 0 200 L 400 180" stroke="white" strokeWidth="14" strokeLinecap="round" />
        <path d="M 0 200 L 400 180" stroke="oklch(0.88 0.005 220)" strokeWidth="1" strokeDasharray="6 8" />
        <path d="M 80 0 L 100 300" stroke="white" strokeWidth="12" strokeLinecap="round" />
        <path d="M 80 0 L 100 300" stroke="oklch(0.88 0.005 220)" strokeWidth="1" strokeDasharray="6 8" />
        <path d="M 250 0 L 280 300" stroke="white" strokeWidth="10" strokeLinecap="round" />

        {/* route */}
        <path d={path} stroke="oklch(0.85 0.05 148)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d={path} stroke="var(--color-primary)" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="6 6">
          <animate attributeName="stroke-dashoffset" from="24" to="0" dur="1s" repeatCount="indefinite" />
        </path>

        {/* restaurant pin */}
        <g transform="translate(60 230)">
          <circle r="10" fill="var(--color-primary)" />
          <circle r="14" fill="var(--color-primary)" opacity="0.25" />
          <text x="0" y="3" textAnchor="middle" fontSize="11" fill="white">🍽</text>
        </g>
        {/* home pin */}
        <g transform="translate(340 70)">
          <circle r="10" fill="oklch(0.3 0.02 240)" />
          <circle r="14" fill="oklch(0.3 0.02 240)" opacity="0.2" />
          <text x="0" y="3" textAnchor="middle" fontSize="11" fill="white">🏠</text>
        </g>

        {/* driver pin */}
        <g transform={`translate(${pt.x} ${pt.y})`}>
          <circle r="16" fill="var(--color-primary)" opacity="0.18">
            <animate attributeName="r" values="14;22;14" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle r="11" fill="white" />
          <text x="0" y="4" textAnchor="middle" fontSize="14">🛵</text>
        </g>
      </svg>
    </div>
  );
}

function pointOnCubic(
  x0: number, y0: number,
  x1: number, y1: number,
  x2: number, y2: number,
  x3: number, y3: number,
  t: number,
) {
  const u = 1 - t;
  const x = u*u*u*x0 + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3;
  const y = u*u*u*y0 + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3;
  return { x, y };
}
