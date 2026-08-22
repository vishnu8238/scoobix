
CREATE TABLE IF NOT EXISTS public.driver_payout_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    gross_earnings NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_deductions NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_payable NUMERIC(15, 2) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    created_by UUID,
    approved_by UUID,
    settled_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    settled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    CONSTRAINT driver_payout_periods_status_check CHECK (status IN ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SETTLED', 'VOID')),
    UNIQUE (driver_id, period_start, period_end)
);

CREATE TABLE IF NOT EXISTS public.driver_payout_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_period_id UUID NOT NULL REFERENCES public.driver_payout_periods(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    direction TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    source_table TEXT,
    source_id TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT driver_payout_line_items_direction_check CHECK (direction IN ('CREDIT', 'DEBIT')),
    UNIQUE (source_table, source_id, payout_period_id)
);

CREATE TABLE IF NOT EXISTS public.driver_payout_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_period_id UUID NOT NULL REFERENCES public.driver_payout_periods(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    method TEXT NOT NULL,
    reference TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'RECORDED',
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    recorded_by UUID,
    notes TEXT,
    CONSTRAINT driver_payout_settlements_status_check CHECK (status IN ('RECORDED', 'VOID'))
);

GRANT SELECT, INSERT, UPDATE ON public.driver_payout_periods TO authenticated;
GRANT ALL ON public.driver_payout_periods TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.driver_payout_line_items TO authenticated;
GRANT ALL ON public.driver_payout_line_items TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.driver_payout_settlements TO authenticated;
GRANT ALL ON public.driver_payout_settlements TO service_role;

ALTER TABLE public.driver_payout_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payout_settlements ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins and Logistics can manage all payout periods') THEN
        CREATE POLICY "Admins and Logistics can manage all payout periods"
        ON public.driver_payout_periods FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.portal_access pa 
                WHERE pa.email_normalized = (SELECT email_normalized FROM public.users WHERE id = auth.uid()::text)
                AND pa.portal IN ('admin', 'logistics') 
                AND pa.status = 'active'
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Riders can view their own payout periods') THEN
        CREATE POLICY "Riders can view their own payout periods"
        ON public.driver_payout_periods FOR SELECT TO authenticated
        USING (auth.uid() = driver_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins and Logistics can manage all payout line items') THEN
        CREATE POLICY "Admins and Logistics can manage all payout line items"
        ON public.driver_payout_line_items FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.portal_access pa 
                WHERE pa.email_normalized = (SELECT email_normalized FROM public.users WHERE id = auth.uid()::text)
                AND pa.portal IN ('admin', 'logistics') 
                AND pa.status = 'active'
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Riders can view their own payout line items') THEN
        CREATE POLICY "Riders can view their own payout line items"
        ON public.driver_payout_line_items FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.driver_payout_periods p WHERE p.id = payout_period_id AND p.driver_id = auth.uid()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Admins and Logistics can manage all settlements') THEN
        CREATE POLICY "Admins and Logistics can manage all settlements"
        ON public.driver_payout_settlements FOR ALL TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.portal_access pa 
                WHERE pa.email_normalized = (SELECT email_normalized FROM public.users WHERE id = auth.uid()::text)
                AND pa.portal IN ('admin', 'logistics') 
                AND pa.status = 'active'
            )
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Riders can view their own settlements') THEN
        CREATE POLICY "Riders can view their own settlements"
        ON public.driver_payout_settlements FOR SELECT TO authenticated
        USING (EXISTS (SELECT 1 FROM public.driver_payout_periods p WHERE p.id = payout_period_id AND p.driver_id = auth.uid()));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_driver_payout_periods_driver ON public.driver_payout_periods(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_payout_line_items_period ON public.driver_payout_line_items(payout_period_id);
CREATE INDEX IF NOT EXISTS idx_driver_payout_line_items_source ON public.driver_payout_line_items(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_driver_payout_settlements_period ON public.driver_payout_settlements(payout_period_id);
