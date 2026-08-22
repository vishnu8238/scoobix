import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

export type PayoutStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'SETTLED' | 'VOID';
export type Direction = 'CREDIT' | 'DEBIT';

export interface PayoutPeriod {
  id: string;
  driver_id: string; // References drivers.id
  period_start: string;
  period_end: string;
  gross_earnings: number;
  total_credits: number;
  total_deductions: number;
  net_payable: number;
  status: PayoutStatus;
  created_at: string;
  updated_at?: string;
}

export interface PayoutLineItem {
  id: string;
  payout_period_id: string;
  direction: Direction;
  amount: number;
  business_date: string;
  category: string;
  description: string;
  source_table?: string;
  source_id?: string;
  is_manual?: boolean;
  reason?: string;
  created_at: string;
}

export interface PayoutSettlement {
  id: string;
  payout_period_id: string;
  amount: number;
  method: string;
  reference: string;
  status: string;
  created_at: string;
}

/**
 * Calculates a draft payout for a driver in a specific date range.
 * Only 'DELIVERED' orders are considered.
 * driver_id MUST be the UUID from the 'drivers' table.
 */
export async function calculateDraftPayout(driverId: string, start: string, end: string) {
  if (!driverId) throw new Error("driverId is required for payout calculation");

  const orders = await listTable<any>("orders", {
    driver_id: `eq.${driverId}`,
    status: "eq.DELIVERED",
    "created_at.gte": start,
    "created_at.lte": end
  });

  const lineItems: Partial<PayoutLineItem>[] = [];
  let gross = 0;

  orders.forEach(o => {
    // Canonical earnings source: orders.driver_earnings
    const earnings = Number(o.driver_earnings || 0);
    const date = o.created_at.split('T')[0];

    if (earnings > 0) {
      lineItems.push({
        business_date: date,
        direction: 'CREDIT',
        category: 'DELIVERY_EARNINGS',
        description: `Order #${o.id.slice(0, 8)}`,
        amount: earnings,
        source_table: 'orders',
        source_id: o.id,
        is_manual: false
      });
      gross += earnings;
    }
  });

  return {
    gross_earnings: gross,
    total_credits: gross,
    total_deductions: 0,
    net_payable: gross,
    line_items: lineItems
  };
}

export async function createPayoutPeriod(data: Partial<PayoutPeriod>, lineItems: Partial<PayoutLineItem>[]) {
  const periodId = newUuid();
  const now = new Date().toISOString();
  
  const period = await createRecord<PayoutPeriod>("driver_payout_periods", {
    ...data,
    id: periodId,
    status: 'DRAFT',
    created_at: now
  });

  if (!period) throw new Error("Failed to create payout period.");

  for (const item of lineItems) {
    await createRecord("driver_payout_line_items", {
      ...item,
      id: newUuid(),
      payout_period_id: periodId,
      created_at: now
    });
  }

  return period;
}

export async function updatePayoutStatus(id: string, status: PayoutStatus) {
  return patchRecord("driver_payout_periods", id, { 
    status,
    updated_at: new Date().toISOString()
  });
}

export async function recordSettlement(data: { payout_period_id: string, amount: number, method: string, reference: string, status: string }) {
  const settlement = await createRecord<PayoutSettlement>("driver_payout_settlements", {
    ...data,
    id: newUuid(),
    created_at: new Date().toISOString()
  });

  if (settlement) {
    await updatePayoutStatus(data.payout_period_id, 'SETTLED');
  }

  return settlement;
}

export async function getPayoutPeriods(params: Record<string, string> = {}) {
  return listTable<PayoutPeriod>("driver_payout_periods", {
    order: "-created_at",
    ...params
  });
}

export async function getPayoutDetails(periodId: string) {
  const [period] = await listTable<PayoutPeriod>("driver_payout_periods", { id: `eq.${periodId}`, limit: 1 });
  const lineItems = await listTable<PayoutLineItem>("driver_payout_line_items", { payout_period_id: `eq.${periodId}`, order: "business_date.asc" });
  const [settlement] = await listTable<PayoutSettlement>("driver_payout_settlements", { payout_period_id: `eq.${periodId}`, limit: 1 });
  
  return { period, lineItems, settlement };
}

export async function addAdjustment(periodId: string, data: { direction: Direction, category: string, description: string, amount: number, reason: string }) {
  if (data.direction === 'DEBIT' && !data.reason) {
    throw new Error("A reason is required for manual debit adjustments.");
  }

  const item = await createRecord<PayoutLineItem>("driver_payout_line_items", {
    id: newUuid(),
    payout_period_id: periodId,
    business_date: new Date().toISOString().split('T')[0],
    ...data,
    is_manual: true,
    created_at: new Date().toISOString()
  });

  if (item) {
    const [period] = await listTable<PayoutPeriod>("driver_payout_periods", { id: `eq.${periodId}`, limit: 1 });
    if (period) {
      const isCredit = data.direction === 'CREDIT';
      const amount = Number(data.amount);
      const patch: any = {};
      
      if (isCredit) {
        patch.total_credits = Number(period.total_credits || period.gross_earnings) + amount;
      } else {
        patch.total_deductions = Number(period.total_deductions) + amount;
      }
      
      const credits = patch.total_credits ?? period.total_credits ?? period.gross_earnings;
      const deductions = patch.total_deductions ?? period.total_deductions;
      patch.net_payable = Number(credits) - Number(deductions);
      
      await patchRecord("driver_payout_periods", periodId, patch);
    }
  }

  return item;
}
