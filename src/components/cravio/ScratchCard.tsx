import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/format";

/**
 * Interactive scratch card. Reuses Cravio tokens (gradient-primary, etc.).
 * Renders a foil overlay on a canvas; user drags to reveal the reward beneath.
 * Auto-reveals when ~55% scratched.
 */
export function ScratchCard({
  className,
  onReveal,
  children,
}: {
  className?: string;
  onReveal?: () => void;
  children: React.ReactNode;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [revealed, setRevealed] = useState(false);
  const drawing = useRef(false);

  const paintFoil = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "#1e7a44");
    g.addColorStop(0.5, "#28a156");
    g.addColorStop(1, "#5fd58a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 18; y < h; y += 36) {
      for (let x = 0; x < w; x += 110) {
        ctx.fillText("SCRATCH ME", x, y);
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapperRef.current;
    if (!canvas || !wrap) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrap.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + "px";
    canvas.style.height = rect.height + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    paintFoil(ctx, rect.width, rect.height);
  }, [paintFoil]);

  const erase = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();
  };

  const checkReveal = () => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    // Sample alpha channel sparsely for speed
    const sample = ctx.getImageData(0, 0, width, height).data;
    let cleared = 0;
    let total = 0;
    for (let i = 3; i < sample.length; i += 80) {
      total++;
      if (sample[i] < 32) cleared++;
    }
    if (cleared / total > 0.45) {
      // Clear fully and fire onReveal
      const ctx2 = canvas.getContext("2d");
      if (ctx2) ctx2.clearRect(0, 0, canvas.width, canvas.height);
      setRevealed(true);
      onReveal?.();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    erase(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    erase(e.clientX, e.clientY);
  };
  const onPointerUp = () => {
    drawing.current = false;
    checkReveal();
  };

  return (
    <div ref={wrapperRef} className={cn("relative overflow-hidden rounded-3xl ring-1 ring-border/60 shadow-card bg-card", className)}>
      <div className="absolute inset-0 grid place-items-center p-6 text-center">
        {children}
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        className={cn("absolute inset-0 h-full w-full touch-none cursor-grab active:cursor-grabbing transition-opacity", revealed && "opacity-0 pointer-events-none")}
      />
    </div>
  );
}
