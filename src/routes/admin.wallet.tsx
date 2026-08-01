import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Wallet, Plus, Minus, ShieldCheck } from "lucide-react";
import { useWallet, type WalletTxn } from "@/lib/scoobix-loyalty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currency } from "@/lib/format";
import { toast } from "sonner";
import { EmptyState } from "@/components/cravio/EmptyState";

export const Route = createFileRoute("/admin/wallet")({
  head: () => ({ meta: [
    { title: "Scoobix Admin · Wallets" },
    { name: "description", content: "Credit or debit customer wallets, view balances and full transaction history." },
  ] }),
  component: AdminWalletPage,
});

function AdminWalletPage() {
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
      const res = await credit(customerId.trim(), amt, "admin_credit", note || "Admin credit");
      if (!res.ok) { toast.error(res.reason ?? "Credit failed"); return; }
      toast.success("Wallet credited");
    } else {
      const res = await debit(customerId.trim(), amt, "admin_debit", note || "Admin debit");
      if (!res.ok) { toast.error(res.reason ?? "Debit failed"); return; }
      toast.success("Wallet debited");
    }
    setAmount(""); setNote("");
  };

  const refunds = allTxns.filter((t) => t.kind === "refund");

  return (
    <div className="space-y-4">
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

      <section className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
        <h2 className="eyebrow mb-2">Balances</h2>
        {balances.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="No wallets yet" description="Wallet balances appear here once customers earn or spend." />
        ) : (
          <ul className="divide-y divide-border/60">
            {balances.map(([cid, bal]) => (
              <li key={cid} className="flex items-center justify-between py-2 text-sm">
                <span className="font-mono text-xs">{cid}</span>
                <span className="font-bold">{currency(bal)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <TxnList title="All transactions" items={allTxns} />
        <TxnList title="Refund history" items={refunds} emptyDesc="Refunds appear here when orders are cancelled." />
      </section>
    </div>
  );
}

function TxnList({ title, items, emptyDesc }: { title: string; items: WalletTxn[]; emptyDesc?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-card ring-1 ring-border/60">
      <h2 className="eyebrow mb-2">{title}</h2>
      {items.length === 0 ? (
        <EmptyState icon={<Wallet className="h-5 w-5" />} title="Nothing yet" description={emptyDesc ?? "No entries yet."} />
      ) : (
        <ul className="divide-y divide-border/60">
          {items.slice(0, 40).map((t) => (
            <li key={t.id} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-2 py-2 text-xs">
              <span className="truncate">
                <span className="font-mono">{t.customerId}</span>
                <span className="block text-[10px] text-muted-foreground">{t.note}</span>
              </span>
              <span className="text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()} · {t.kind}</span>
              <span className={`font-bold ${t.amount >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {t.amount >= 0 ? "+" : ""}{currency(t.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
