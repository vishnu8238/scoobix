import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/cravio/PageHeader";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [
    { title: "Cravio · Terms of service" },
    { name: "description", content: "Cravio terms of service – the agreement between you and Cravio for ordering food and partnering with us." },
  ] }),
  component: TermsPage,
});

const SECTIONS = [
  { title: "1. Acceptance",     body: "By using Cravio you agree to these terms. If you don't, please don't use the service. We may update these terms; we'll notify you in the app when we do." },
  { title: "2. Your account",   body: "You're responsible for keeping your login secure and for everything that happens on your account. You must be 13+ to use Cravio." },
  { title: "3. Orders & payment", body: "When you place an order, you authorise us to charge your selected payment method. Prices include taxes unless stated. Some items, delivery times and offers are subject to availability." },
  { title: "4. Cancellation & refunds", body: "Orders can be cancelled before the restaurant accepts them. After acceptance, contact support. Refunds are processed within 5–7 business days." },
  { title: "5. Restaurant partners", body: "Partners are independent businesses responsible for food preparation, hygiene, packaging and accuracy of menu information." },
  { title: "6. Delivery partners", body: "Delivery partners are independent contractors. Tips go fully to the rider. Behave respectfully – we take harassment seriously." },
  { title: "7. Liability",      body: "Cravio acts as a marketplace. To the extent permitted by law, our liability is limited to the value of the order in dispute." },
  { title: "8. Contact",        body: "Questions? Reach us at help@cravio.app. We respond within 24 hours on business days." },
];

function TermsPage() {
  return (
    <div className="mx-auto min-h-svh max-w-[720px] pb-16">
      <PageHeader title="Terms of service" subtitle="Last updated · 1 Jun 2026" />

      <article className="px-5 pt-4">
        <p className="text-sm text-muted-foreground">These terms govern your use of Cravio, the food-ordering platform operated by Cravio Foods Pvt. Ltd. Please read carefully.</p>

        <div className="mt-6 space-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title} className="rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border/60">
              <h3 className="font-display text-base font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-center text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          See also: <Link to="/privacy" className="font-bold text-primary">Privacy policy</Link>
        </p>
      </article>
    </div>
  );
}
