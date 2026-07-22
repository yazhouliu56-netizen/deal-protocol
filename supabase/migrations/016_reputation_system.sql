-- ============================================================
-- M16: 双端履约评价与声誉防御系统（信任流）
-- ============================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reputation_score NUMERIC(3, 2) DEFAULT 5.00;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'NORMAL';

CREATE TABLE IF NOT EXISTS public.order_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    reviewer_id UUID NOT NULL,
    reviewee_id UUID NOT NULL,
    rating INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT chk_review_rating CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT uniq_order_reviewer UNIQUE (order_id, reviewer_id),
    CONSTRAINT fk_reviews_order FOREIGN KEY (order_id) REFERENCES public.demands(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_order_reviews_reviewee ON public.order_reviews(reviewee_id);

ALTER TABLE public.order_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read reviews"
    ON public.order_reviews FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Partners of the order can insert reviews"
    ON public.order_reviews FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = reviewer_id);

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
    SELECT ROUND(AVG(rating)::numeric, 2) INTO v_avg_rating
    FROM public.order_reviews
    WHERE reviewee_id = NEW.reviewee_id;

    SELECT COUNT(id) INTO v_low_review_count
    FROM public.order_reviews
    WHERE reviewee_id = NEW.reviewee_id AND rating <= 2;

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

CREATE TRIGGER after_review_inserted
  AFTER INSERT ON public.order_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.process_review_reputation_trigger();
