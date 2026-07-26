/**
 * Saved payment methods.
 *
 * InsForge has no saved-cards table (`payments` stores transactions only), so
 * methods persist as a JSON row in `app_settings` keyed per user.
 */
import { useCallback, useEffect, useState } from "react";
import { kvGet, kvSet } from "./kv-store";
import { useAuth } from "./auth-store";

export type PaymentMethodRow = { id: string; brand: string; last4: string; default: boolean };

export function usePaymentMethods() {
  const { user } = useAuth();
  const key = `payment_methods:${user?.id ?? "guest"}`;
  const [rows, setRows] = useState<PaymentMethodRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void kvGet<PaymentMethodRow[]>(key).then((v) => {
      if (!cancelled) setRows(Array.isArray(v) ? v : []);
    });
    return () => { cancelled = true; };
  }, [key]);

  const add = useCallback((brand: string, last4: string) => {
    setRows((prev) => {
      const next = [...prev, { id: `pm${Date.now().toString(36)}`, brand, last4, default: prev.length === 0 }];
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  const remove = useCallback((id: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      void kvSet(key, next);
      return next;
    });
  }, [key]);

  return { rows, add, remove };
}
