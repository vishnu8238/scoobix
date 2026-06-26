import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [
    { title: "Cravio · Privacy policy" },
    { name: "description", content: "How Cravio collects, uses and protects your data when you order food or partner with us." },
  ] }),
  component: PrivacyPage,
});

const SECTIONS = [
  { title: "What we collect", body: "Account details (name, phone, email), delivery addresses, order history, payment metadata (we don't store full card numbers) and device info to keep your account secure." },
  { title: "Why we collect it", body: "To deliver orders, process payments, send order updates, recommend restaurants, prevent fraud and improve the app." },
  { title: "Who we share with", body: "Restaurant partners receive only what they need to prepare your order. Riders see your name, address and phone for delivery. Payment providers process transactions. We never sell your data." },
  { title: "Location data", body: "We use precise location only when you allow it and only to find nearby restaurants and route deliveries. You can revoke permission anytime in your device settings." },
  { title: "Your controls", body: "You can review, edit or delete your data in Profile → Privacy. You can export an archive or close your account at any time." },
  { title: "Cookies & analytics", body: "We use first-party cookies for sessions and aggregated analytics. We don't use third-party advertising trackers." },
  { title: "Security", body: "Data is encrypted in transit (TLS 1.3) and at rest. Card data is tokenised by our PCI-DSS certified payment processor." },
  { title: "Contact us", body: "Privacy questions: privacy@cravio.app · For data deletion requests, email us with the subject 'Delete my data'." },
];

function PrivacyPage() {
  return (
    <div className="mx-auto min-h-svh max-w-[720px] pb-16">
      <PageHeader title="Privacy policy" subtitle="Last updated · 1 Jun 2026" />

      <article className="px-5 pt-4">
        <p className="text-sm text-muted-foreground">Your trust matters. This page explains what data Cravio collects, why we collect it, and how you can control it.</p>

        <div className="mt-6 space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
              <h3 className="font-display text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          See also: <Link to="/terms" className="font-bold text-primary">Terms of service</Link>
        </p>
      </article>
    </div>
  );
}
