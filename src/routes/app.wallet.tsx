import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, Gift, RefreshCcw, ShieldCheck } from "lucide-react";
import { useMyWallet } from "@/lib/scoobix-loyalty";
import { EmptyState } from "@/components/cravio/EmptyState";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/app/wallet")({
  head: () => ({ meta: [
    { title: "Scoobix Wallet" },
    { name: "description", content: "Your Scoobix Wallet balance, cashback and transaction history." },
  ] }),
  component: WalletPage,
});

const KIND_ICON = {
  credit: ArrowDownLeft, cashback: Gift, scratch: Gift,
  refund: RefreshCcw, admin: ShieldCheck, debit: ArrowUpRight,
} as const;

function WalletPage() {
  const navigate = useNavigate();
  const { balance, txns } = useMyWallet();

  return (
    <div className="min-h-svh pb-24">
      <header className="sticky top-0 z-30 glass px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-3">
          <button onClick={() => navigate({ to: "/app/more" })} className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><ArrowLeft className="h-4 w-4" /></button>
          <h1 className="text-center font-display text-base font-bold">Scoobix Wallet</h1>
          <div />
        </div>
      </header>

      <section className="p-4">
        <div className="rounded-3xl gradient-primary p-5 text-primary-foreground shadow-glow">
          <div className="flex items-center gap-2 text-xs opacity-90"><Wallet className="h-3.5 w-3.5" /> Wallet balance</div>
          <p className="mt-1 font-display text-3xl font-extrabold">{currency(balance)}</p>
          <p className="mt-1 text-xs opacity-80">Use at checkout · full or partial payment</p>
        </div>
      </section>

      <section className="px-4">
        <h2 className="eyebrow mb-2">Transactions</h2>
        {txns.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="No transactions yet" description="Earn cashback and scratch cards on your next order." />
        ) : (
          <ul className="divide-y divide-border/60 rounded-3xl bg-card shadow-card ring-1 ring-border/60">
            {txns.map((t) => {
              const Icon = KIND_ICON[t.kind] ?? Wallet;
              const positive = t.amount >= 0;
              return (
                <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <span className={`grid h-9 w-9 place-items-center rounded-full ${positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t.note}</span>
                    <span className="block text-[11px] text-muted-foreground">{new Date(t.createdAt).toLocaleString()} · {t.kind}</span>
                  </span>
                  <span className={`font-bold ${positive ? "text-emerald-600" : "text-rose-600"}`}>
                    {positive ? "+" : ""}{currency(t.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
