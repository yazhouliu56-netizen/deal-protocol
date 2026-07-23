-- Grant table-level permissions to service_role and authenticated for all new tables
-- Run after all table-creating migrations

GRANT ALL ON TABLE public.provider_wallets TO service_role, authenticated;
GRANT ALL ON TABLE public.wallet_logs TO service_role, authenticated;
GRANT ALL ON TABLE public.order_disputes TO service_role, authenticated;
GRANT ALL ON TABLE public.withdrawal_requests TO service_role, authenticated;
GRANT ALL ON TABLE public.notifications TO service_role, authenticated;
GRANT ALL ON TABLE public.order_reviews TO service_role, authenticated;
GRANT ALL ON TABLE public.developer_profiles TO service_role, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role, authenticated;

NOTIFY pgrst, 'reload schema';
