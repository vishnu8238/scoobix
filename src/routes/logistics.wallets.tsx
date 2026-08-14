import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Plus, Minus, ShieldCheck } from "lucide-react";
import { useWallet, type WalletTxn } from "@/lib/scoobix-loyalty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/format";
import { toast } from "sonner";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/logistics/wallets")({
  head: () => ({ meta: [
    { title: "Scoobix Logistics · Wallets" },
    { name: "description", content: "Credit or debit customer wallets, view balances and full transaction history." },
  ] }),
  component: LogisticsWallets,
});

function LogisticsWallets() {
  const { allTxns, credit, debit } = useWallet();
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const balances = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTxns) map.set(t.customerId, (map.get(t.customerId) ?? 0) + t.amount);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [allTxns]);

  const submit = async (kind: "credit" | "debit") => {
    const amt = Number(amount);
    if (!customerId.trim() || !Number.isFinite(amt) || amt <= 0) { toast.error("Enter customer id and amount"); return; }
    if (kind === "credit") {
      const res = await credit(customerId.trim(), amt, "admin_credit", note || "Logistics credit");
      if (!res.ok) { toast.error(res.reason ?? "Credit failed"); return; }
      toast.success("Wallet credited");
    } else {
      const res = await debit(customerId.trim(), amt, "admin_debit", note || "Logistics debit");
      if (!res.ok) { toast.error(res.reason ?? "Debit failed"); return; }
      toast.success("Wallet debited");
    }
    setAmount(""); setNote("");
  };

  return (
    <div className="space-y-4 text-left">
      <header className="flex items-center gap-2">
        <Wallet className="h-5 w-5 text-primary" />
        <h1 className="font-display text-lg font-extrabold">Wallets & refunds</h1>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
        <p className="eyebrow flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Adjust customer wallet</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.2fr)_1fr_1.4fr_auto_auto]">
          <Input placeholder="Customer id" value={customerId} onChange={(e) => setCustomerId(e.target.value)} />
          <Input placeholder="Amount ₹" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={() => void submit("credit")} className="rounded-full"><Plus className="mr-1 h-4 w-4" /> Credit</Button>
          <Button onClick={() => void submit("debit")} variant="outline" className="rounded-full"><Minus className="mr-1 h-4 w-4" /> Debit</Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
          <h2 className="eyebrow mb-2">Balances</h2>
          {balances.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="No wallets yet" description="Wallet balances appear here." />
          ) : (
            <ul className="divide-y divide-border/60">
              {balances.slice(0, 10).map(([cid, bal]) => (
                <li key={cid} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-mono text-xs">{cid.slice(0, 12)}…</span>
                  <span className="font-bold">{currency(bal)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
           <h2 className="eyebrow mb-2">Recent Transactions</h2>
           <ul className="divide-y divide-border/60">
             {allTxns.slice(0, 10).map(t => (
               <li key={t.id} className="flex items-center justify-between py-2 text-[10px]">
                  <div className="flex flex-col">
                    <span className="font-bold">{t.note}</span>
                    <span className="text-muted-foreground">{t.customerId.slice(0, 8)}</span>
                  </div>
                  <span className={`font-black ${t.amount > 0 ? "text-emerald-600" : "text-rose-600"}`}>{t.amount > 0 ? "+" : ""}{currency(t.amount)}</span>
               </li>
             ))}
           </ul>
        </section>
      </div>
    </div>
  );
}
