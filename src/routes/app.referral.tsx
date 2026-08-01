import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Share2, Copy, Gift, Users, IndianRupee } from "lucide-react";
import { useReferral, qrUrl } from "@/lib/scoobix-loyalty";
import { useAuth } from "@/lib/auth-store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/app/referral")({
  head: () => ({ meta: [
    { title: "Scoobix · Invite & earn" },
    { name: "description", content: "Share your Scoobix code and both you and your friend earn wallet credit." },
  ] }),
  component: ReferralPage,
});

function ReferralPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { config, codeFor, statsFor } = useReferral();
  const cid = user?.id ?? "guest";
  const code = codeFor(cid);
  const link = typeof window !== "undefined" ? `${window.location.origin}/auth/signup?ref=${code}` : `https://scoobix.app/?ref=${code}`;
  const stats = statsFor(cid);
  const qr = useMemo(() => qrUrl(link, 220), [link]);

  const share = async (channel?: "whatsapp" | "sms" | "native") => {
    const text = `Get ${config.refereeReward} off your first Scoobix order — use my code ${code}. ${link}`;
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank"); return;
    }
    if (channel === "sms") {
      window.open(`sms:?&body=${encodeURIComponent(text)}`, "_self"); return;
    }
    try {
      if (navigator.share) await navigator.share({ title: "Scoobix invite", text, url: link });
      else { await navigator.clipboard.writeText(link); toast.success("Invite link copied"); }
    } catch { /* cancelled */ }
  };

  const copyCode = async () => { await navigator.clipboard.writeText(code); toast.success("Code copied"); };

  if (!config.enabled) {
    return (
      <div className="min-h-svh p-6 text-center text-sm text-muted-foreground">
        The referral program is currently paused. Please check back soon.
      </div>
    );
  }

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/more" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Invite & earn</h1>
          <div />
        </div>
      </header>

      <section className="p-4">
        <div className="rounded-3xl bg-card p-5 text-center shadow-card ring-1 ring-border/60">
          <p className="eyebrow flex items-center justify-center gap-1"><Gift className="h-3 w-3" /> Give ₹{config.refereeReward} · Get ₹{config.referrerReward}</p>
          <h2 className="mt-1 font-display text-xl font-extrabold">Share Scoobix, earn wallet credit</h2>
          <p className="mt-1 text-xs text-muted-foreground">Friend orders ₹{config.minOrder}+ · both get credited. Valid for {config.expiryDays} days.</p>

          <div className="mx-auto mt-4 grid w-fit place-items-center rounded-2xl bg-white p-3 ring-1 ring-border/60">
            <img src={qr} alt="Referral QR code" width={180} height={180} loading="lazy" decoding="async" className="rounded-xl" />
          </div>

          <button onClick={copyCode} className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-bold">
            {code} <Copy className="h-3.5 w-3.5" />
          </button>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button onClick={() => share("whatsapp")} variant="outline" className="rounded-full">WhatsApp</Button>
            <Button onClick={() => share("sms")}      variant="outline" className="rounded-full">SMS</Button>
            <Button onClick={() => share("native")}   className="rounded-full gradient-primary text-primary-foreground shadow-glow"><Share2 className="mr-1 h-4 w-4" /> Share</Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat icon={Users}       label="Invites"   value={String(stats.invited)} />
          <Stat icon={Gift}        label="Rewarded"  value={String(stats.ordered)} />
          <Stat icon={IndianRupee} label="Earned"    value={`₹${stats.earned}`} />
        </div>
      </section>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-card p-3 text-center shadow-card ring-1 ring-border/60">
      <Icon className="mx-auto h-4 w-4 text-primary" />
      <p className="mt-1 font-display text-lg font-extrabold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
