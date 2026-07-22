-- ============================================================
-- M13: 纠纷记录表 — 管理后台仲裁与上帝判决
-- ============================================================

CREATE TABLE IF NOT EXISTS public.order_disputes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL UNIQUE,
    initiator_id UUID NOT NULL,
    reason TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT ARRAY[]::TEXT[],
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_dispute_status CHECK (status IN ('pending', 'refunded', 'force_settled')),
    CONSTRAINT fk_disputes_order FOREIGN KEY (order_id) REFERENCES public.demands(id) ON DELETE CASCADE
);

ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins have full access to order disputes"
    ON public.order_disputes
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role = 'admin'
        )
    );
