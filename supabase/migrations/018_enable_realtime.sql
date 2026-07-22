-- ============================================================
-- M18: 启用 Supabase Realtime 广播权限
-- 将需要实时订阅的表加入 supabase_realtime publication
-- 使 postgres_changes 客户端能收到变更推送
-- ============================================================

DO $$
BEGIN
  PERFORM FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'orders';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;
END $$;

DO $$
BEGIN
  PERFORM FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'profiles';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;

DO $$
BEGIN
  PERFORM FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'provider_wallets';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.provider_wallets;
  END IF;
END $$;

DO $$
BEGIN
  PERFORM FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'demands';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demands;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'withdrawal_requests') THEN
    PERFORM FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'withdrawal_requests';
    IF NOT FOUND THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawal_requests;
    END IF;
  END IF;
END $$;
