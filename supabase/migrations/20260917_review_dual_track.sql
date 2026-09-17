-- ============================================================
-- R4-1: 评价双轨落库（用户裁决 2026-09-16）
-- 纯加法、可重跑：三勾/checks＋tags＋盲态/释放时刻落 order_reviews；
-- RLS 收紧（双盲/k 门地基）；触发器仅 revealed 行触发（防报复定位）。
-- ============================================================

-- 1. 文案可空（Tag/原因不强制裁决）
ALTER TABLE public.order_reviews ALTER COLUMN comment DROP NOT NULL;

-- 2. 双轨列（全可空新增，老行零影响）
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS contract_id UUID;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS checks JSONB;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS tags JSONB;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS has_after_photo BOOLEAN DEFAULT FALSE;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS passed_count INT;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS blind_state TEXT DEFAULT 'blind';
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS reveal_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_reviews ADD COLUMN IF NOT EXISTS jitter_days INT;

-- 订单归属二选一（demands 老链路 / contracts 新链路至少其一）
ALTER TABLE public.order_reviews ALTER COLUMN order_id DROP NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reviews_order_ref'
  ) THEN
    ALTER TABLE public.order_reviews ADD CONSTRAINT chk_reviews_order_ref
      CHECK (order_id IS NOT NULL OR contract_id IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reviews_passed_count'
  ) THEN
    ALTER TABLE public.order_reviews ADD CONSTRAINT chk_reviews_passed_count
      CHECK (passed_count IS NULL OR (passed_count >= 0 AND passed_count <= 3));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_reviews_blind_state'
  ) THEN
    ALTER TABLE public.order_reviews ADD CONSTRAINT chk_reviews_blind_state
      CHECK (blind_state IS NULL OR blind_state IN ('blind', 'revealed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_reviews_contract'
  ) THEN
    ALTER TABLE public.order_reviews ADD CONSTRAINT fk_reviews_contract
      FOREIGN KEY (contract_id) REFERENCES public.contracts(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- 揭晓扫表索引（cron/路由按 reveal_at 捞 blind 行）
CREATE INDEX IF NOT EXISTS idx_order_reviews_reveal
  ON public.order_reviews(reveal_at) WHERE blind_state = 'blind';

-- 3. RLS 收紧：全员可读 → 本人见自己＋他人仅见已揭晓
DROP POLICY IF EXISTS "Anyone authenticated can read reviews" ON public.order_reviews;
CREATE POLICY "Reviewer reads own rows"
  ON public.order_reviews FOR SELECT TO authenticated
  USING (auth.uid() = reviewer_id);
CREATE POLICY "Others read revealed rows only"
  ON public.order_reviews FOR SELECT TO authenticated
  USING (COALESCE(blind_state, 'revealed') = 'revealed');

-- 4. 触发器加 revealed 门（blind 行不算分、不通知，防报复定位实锤通道）
CREATE OR REPLACE FUNCTION public.process_review_reputation_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_avg_rating NUMERIC(3, 2);
    v_low_review_count INT;
    v_new_status TEXT;
BEGIN
    IF COALESCE(NEW.blind_state, 'revealed') <> 'revealed' THEN
        RETURN NEW;
    END IF;

    SELECT ROUND(AVG(rating)::numeric, 2) INTO v_avg_rating
    FROM public.order_reviews
    WHERE reviewee_id = NEW.reviewee_id
      AND COALESCE(blind_state, 'revealed') = 'revealed';

    SELECT COUNT(id) INTO v_low_review_count
    FROM public.order_reviews
    WHERE reviewee_id = NEW.reviewee_id AND rating <= 2
      AND COALESCE(blind_state, 'revealed') = 'revealed';

    v_new_status := 'NORMAL';
    IF v_avg_rating < 3.5 OR v_low_review_count >= 3 THEN
        v_new_status := 'SUSPENDED';
    ELSIF v_avg_rating < 4.2 OR v_low_review_count >= 1 THEN
        v_new_status := 'WARNED';
    END IF;

    UPDATE public.profiles
    SET
        reputation_score = v_avg_rating,
        compliance_status = v_new_status
    WHERE id = NEW.reviewee_id;

    INSERT INTO public.notifications (user_id, title, content, type)
    VALUES (
        NEW.reviewee_id,
        '声誉画像发生变动',
        '收到一条新履约评分: ' || NEW.rating || '星。当前综合声誉分已调整为: ' || v_avg_rating || '，风控状态: ' || v_new_status,
        'system'
    );

    RETURN NEW;
END;
$$;
