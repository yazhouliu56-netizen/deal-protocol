-- ============================================================
-- M14: 服务商提现与财务清算闭环
-- ============================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    channel TEXT NOT NULL,
    account_info TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_withdrawal_status CHECK (status IN ('pending', 'approved', 'rejected')),
    CONSTRAINT chk_withdrawal_amount CHECK (amount > 0),
    CONSTRAINT fk_withdrawals_provider FOREIGN KEY (provider_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers can view their own withdrawals"
    ON public.withdrawal_requests FOR SELECT TO authenticated
    USING (provider_id = auth.uid());

CREATE POLICY "Admins can view and manage all withdrawals"
    ON public.withdrawal_requests FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid() AND public.profiles.role = 'admin'
        )
    );

CREATE OR REPLACE FUNCTION public.submit_withdrawal_request(
    p_amount NUMERIC,
    p_channel TEXT,
    p_account_info TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance NUMERIC;
    v_provider_id UUID;
    v_request_id UUID;
BEGIN
    v_provider_id := auth.uid();
    IF v_provider_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT balance INTO v_balance
    FROM public.provider_wallets
    WHERE provider_id = v_provider_id
    FOR UPDATE;

    IF v_balance IS NULL OR v_balance < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    UPDATE public.provider_wallets
    SET balance = ROUND((balance - p_amount)::numeric, 2),
        updated_at = NOW()
    WHERE provider_id = v_provider_id;

    INSERT INTO public.withdrawal_requests (provider_id, amount, channel, account_info, status)
    VALUES (v_provider_id, p_amount, p_channel, p_account_info, 'pending')
    RETURNING id INTO v_request_id;

    INSERT INTO public.wallet_logs (provider_id, amount, type, description)
    VALUES (v_provider_id, -p_amount, 'withdrawal_freeze',
            'Withdrawal request ' || v_request_id || ' initiated, funds frozen.');

    RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;
