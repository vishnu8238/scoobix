-- Migration: Driver Payout Workspace
-- Schema for operational rider ledger.

-- 1. driver_payout_periods
CREATE TABLE public.driver_payout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    gross_earnings NUMERIC NOT NULL DEFAULT 0,
    total_deductions NUMERIC NOT NULL DEFAULT 0,
    net_payable NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SETTLED', 'VOID')),
    created_by UUID,
    approved_by UUID,
    settled_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_at TIMESTAMPTZ,
    settled_at TIMESTAMPTZ,
    notes TEXT,
    CONSTRAINT unique_non_void_period UNIQUE (driver_id, period_start, period_end)
);

GRANT SELECT, INSERT, UPDATE ON public.driver_payout_periods TO authenticated;
GRANT ALL ON public.driver_payout_periods TO service_role;
ALTER TABLE public.driver_payout_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Logistics can manage all payout periods"
ON public.driver_payout_periods
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (SELECT 1 FROM public.portal_access WHERE email = auth.jwt()->>'email' AND portal = 'logistics')
);

CREATE POLICY "Riders can view their own payout periods"
ON public.driver_payout_periods
FOR SELECT
TO authenticated
USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));

-- 2. driver_payout_line_items
CREATE TABLE public.driver_payout_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_period_id UUID NOT NULL REFERENCES public.driver_payout_periods(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    source_table TEXT,
    source_id TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.driver_payout_line_items TO authenticated;
GRANT ALL ON public.driver_payout_line_items TO service_role;
ALTER TABLE public.driver_payout_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Logistics can manage all line items"
ON public.driver_payout_line_items
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (SELECT 1 FROM public.portal_access WHERE email = auth.jwt()->>'email' AND portal = 'logistics')
);

CREATE POLICY "Riders can view their own line items"
ON public.driver_payout_line_items
FOR SELECT
TO authenticated
USING (payout_period_id IN (SELECT id FROM public.driver_payout_periods WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())));

-- 3. driver_payout_settlements
CREATE TABLE public.driver_payout_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_period_id UUID NOT NULL UNIQUE REFERENCES public.driver_payout_periods(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    method TEXT NOT NULL,
    reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('RECORDED', 'VOID')),
    settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    recorded_by UUID,
    notes TEXT
);

GRANT SELECT, INSERT, UPDATE ON public.driver_payout_settlements TO authenticated;
GRANT ALL ON public.driver_payout_settlements TO service_role;
ALTER TABLE public.driver_payout_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Logistics can manage all settlements"
ON public.driver_payout_settlements
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') OR 
  EXISTS (SELECT 1 FROM public.portal_access WHERE email = auth.jwt()->>'email' AND portal = 'logistics')
);

CREATE POLICY "Riders can view their own settlements"
ON public.driver_payout_settlements
FOR SELECT
TO authenticated
USING (payout_period_id IN (SELECT id FROM public.driver_payout_periods WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())));

-- Indexes
CREATE INDEX idx_driver_payout_periods_driver ON public.driver_payout_periods(driver_id);
CREATE INDEX idx_driver_payout_periods_status ON public.driver_payout_periods(status);
CREATE INDEX idx_driver_payout_line_items_period ON public.driver_payout_line_items(payout_period_id);
CREATE INDEX idx_driver_payout_settlements_period ON public.driver_payout_settlements(payout_period_id);
