/**
 * Wallet API — real `wallet` + `wallet_transactions` tables.
 *
 * wallet:              id, user_id, balance, updated_at
 * wallet_transactions: id, wallet_id, amount, transaction_type, description,
 *                      order_id, created_at
 *
 * The wallet row is the source of truth for the balance; every mutation writes
 * a transaction and then re-stamps the balance.
 */
import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { nudgeTable } from "./realtime";

export type TxnKind = "credit" | "debit" | "cashback" | "refund" | "scratch" | "admin";

export type WalletRow = { id: string; user_id?: string | null; balance?: number | null };

export type WalletTxnRow = {
  id: string;
  wallet_id?: string | null;
  amount?: number | null;
  transaction_type?: string | null;
  description?: string | null;
  order_id?: string | null;
  created_at?: string;
};

const walletIdCache = new Map<string, string>();

export async function getWallet(userId: string): Promise<WalletRow | null> {
  if (!userId) return null;
  const cached = walletIdCache.get(userId);
  if (cached) {
    const rows = await listTable<WalletRow>("wallet", { id: `eq.${cached}`, limit: 1 });
    if (rows[0]) return rows[0];
  }
  const rows = await listTable<WalletRow>("wallet", { user_id: `eq.${userId}`, limit: 1 });
  let row = rows[0] ?? null;
  if (!row) row = await createRecord<WalletRow>("wallet", { user_id: userId, balance: 0 });
  if (row?.id) walletIdCache.set(userId, row.id);
  return row;
}

export async function getBalance(userId: string): Promise<number> {
  const w = await getWallet(userId);
  return Number(w?.balance ?? 0);
}

export async function listTransactions(userId: string): Promise<WalletTxnRow[]> {
  const w = await getWallet(userId);
  if (!w?.id) return [];
  return listTable<WalletTxnRow>("wallet_transactions", {
    wallet_id: `eq.${w.id}`,
    order: "-created_at",
    limit: 200,
  });
}

export async function listAllTransactions(): Promise<Array<WalletTxnRow & { user_id?: string }>> {
  const [txns, wallets] = await Promise.all([
    listTable<WalletTxnRow>("wallet_transactions", { order: "-created_at", limit: 500 }),
    listTable<WalletRow>("wallet", { limit: 500 }),
  ]);
  const byId = new Map(wallets.map((w) => [w.id, w.user_id ?? ""]));
  return txns.map((t) => ({ ...t, user_id: byId.get(String(t.wallet_id ?? "")) ?? "" }));
}

async function write(
  userId: string,
  signedAmount: number,
  kind: TxnKind,
  description: string,
  orderId?: string,
): Promise<{ ok: boolean; balance: number; reason?: string }> {
  const w = await getWallet(userId);
  if (!w?.id) return { ok: false, balance: 0, reason: "Wallet unavailable" };
  const current = Number(w.balance ?? 0);
  const next = current + signedAmount;
  if (next < 0) return { ok: false, balance: current, reason: "Insufficient wallet balance" };
  await createRecord("wallet_transactions", {
    wallet_id: w.id,
    amount: signedAmount,
    transaction_type: kind,
    description,
    order_id: orderId ?? null,
  });
  await patchRecord("wallet", w.id, { balance: next });
  nudgeTable("wallet");
  nudgeTable("wallet_transactions");
  return { ok: true, balance: next };
}

export function creditWallet(userId: string, amount: number, kind: TxnKind, note: string, orderId?: string) {
  return write(userId, Math.abs(amount), kind, note, orderId);
}

export function debitWallet(userId: string, amount: number, kind: TxnKind, note: string, orderId?: string) {
  return write(userId, -Math.abs(amount), kind, note, orderId);
}
