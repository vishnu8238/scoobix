import { listTable, createRecord, patchRecord } from "./insforge-crud";
import { newUuid } from "./orders-api";

export type PayoutStatus = 'DRAFT' | 'READY_FOR_REVIEW' | 'APPROVED' | 'SETTLED' | 'VOID';
export type Direction = 'CREDIT' | 'DEBIT';

export interface PayoutPeriod {
  id: string;
  driver_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  gross_earnings: number;
  total_deductions: number;
  net_payable: number;
  status: PayoutStatus;
  created_by?: string;
  approved_by?: string;
  settled_by?: string;
  created_at: string;
  approved_at?: string;
  settled_at?: string;
  notes?: string;
}

export interface PayoutLineItem {
  id: string;
  payout_period_id: string;
  business_date: string;
  direction: Direction;
  category: string;
  description: string;
  amount: number;
  source_table?: string;
  source_id?: string;
  created_by?: string;
  created_at: string;
}

export interface PayoutSettlement {
  id: string;
  payout_period_id: string;
  amount: number;
  method: string;
  reference: string;
  status: 'RECORDED' | 'VOID';
  settled_at: string;
  recorded_by?: string;
  notes?: string;
}

/**
 * Calculates a draft payout for a driver in a specific date range.
 * Only 'DELIVERED' orders are considered.
 */
export async function calculateDraftPayout(driverId: string, start: string, end: string) {
  const orders = await listTable<any>("orders", {
    driver_id: `eq.${driverId}`,
    status: "eq.DELIVERED",
    "created_at.gte": start,
    "created_at.lte": end
  });

  const lineItems: Partial<PayoutLineItem>[] = [];
  let gross = 0;

  orders.forEach(o => {
    const earnings = Number(o.driver_earnings || 0);
    const tip = Number(o.tip || 0);
    const date = o.created_at.split('T')[0];

    if (earnings > 0) {
      lineItems.push({
        business_date: date,
        direction: 'CREDIT',
        category: 'DELIVERY_PAYOUT',
        description: `Order #${o.id.slice(0, 8)}`,
        amount: earnings,
        source_table: 'orders',
        source_id: o.id
      });
      gross += earnings;
    }

    if (tip > 0) {
      lineItems.push({
        business_date: date,
        direction: 'CREDIT',
        category: 'TIP',
        description: `Tip for Order #${o.id.slice(0, 8)}`,
        amount: tip,
        source_table: 'orders',
        source_id: o.id
      });
      gross += tip;
    }
  });

  return {
    gross_earnings: gross,
    total_deductions: 0,
    net_payable: gross,
    line_items: lineItems
  };
}

export async function createPayoutPeriod(data: Partial<PayoutPeriod>, lineItems: Partial<PayoutLineItem>[]) {
  const periodId = newUuid();
  const period = await createRecord<PayoutPeriod>("driver_payout_periods", {
    ...data,
    id: periodId,
    status: 'DRAFT',
    created_at: new Date().toISOString()
  });

  if (!period) throw new Error("Failed to create payout period.");

  // Create line items sequentially to ensure atomicity in logic if not in DB
  for (const item of lineItems) {
    await createRecord("driver_payout_line_items", {
      ...item,
      id: newUuid(),
      payout_period_id: periodId,
      created_at: new Date().toISOString()
    });
  }

  return period;
}

export async function updatePayoutStatus(id: string, status: PayoutStatus, userId?: string) {
  const patch: any = { status };
  const now = new Date().toISOString();
  
  if (status === 'APPROVED') {
    patch.approved_by = userId;
    patch.approved_at = now;
  } else if (status === 'SETTLED') {
    patch.settled_by = userId;
    patch.settled_at = now;
  }
  
  return patchRecord("driver_payout_periods", id, patch);
}

export async function recordSettlement(data: Partial<PayoutSettlement>, userId?: string) {
  const settlement = await createRecord<PayoutSettlement>("driver_payout_settlements", {
    ...data,
    id: newUuid(),
    status: 'RECORDED',
    settled_at: new Date().toISOString(),
    recorded_by: userId
  });

  if (settlement) {
    await updatePayoutStatus(data.payout_period_id!, 'SETTLED', userId);
  }

  return settlement;
}

export async function addAdjustment(periodId: string, item: Partial<PayoutLineItem>, userId?: string) {
  return createRecord("driver_payout_line_items", {
    ...item,
    id: newUuid(),
    payout_period_id: periodId,
    created_by: userId,
    created_at: new Date().toISOString()
  });
}

export async function fetchPayouts(params: Record<string, any> = {}) {
  return listTable<PayoutPeriod>("driver_payout_periods", {
    order: "created_at.desc",
    ...params
  });
}

export async function fetchPayoutDetails(periodId: string) {
  const [period] = await listTable<PayoutPeriod>("driver_payout_periods", { id: `eq.${periodId}`, limit: 1 });
  if (!period) return null;

  const lineItems = await listTable<PayoutLineItem>("driver_payout_line_items", { 
    payout_period_id: `eq.${periodId}`,
    order: "business_date.asc"
  });

  const [settlement] = await listTable<PayoutSettlement>("driver_payout_settlements", {
    payout_period_id: `eq.${periodId}`,
    limit: 1
  }).catch(() => []);

  return { period, lineItems, settlement };
}
