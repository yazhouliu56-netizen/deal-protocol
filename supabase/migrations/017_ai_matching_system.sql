-- ============================================================
-- M17: AI 智能撮合与商机推荐引擎 — pgvector + 混合评分
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS embedding VECTOR(1536);

CREATE INDEX IF NOT EXISTS idx_demands_embedding
  ON public.demands USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS public.developer_profiles (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    skills TEXT[] DEFAULT '{}'::TEXT[],
    preference_embedding VECTOR(1536),
    last_active_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.developer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to developer profiles"
    ON public.developer_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow developers to update own profiles"
    ON public.developer_profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.match_demands_hybrid(
    p_developer_id UUID,
    p_query_embedding VECTOR(1536),
    p_similarity_threshold NUMERIC,
    p_match_count INT
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    budget NUMERIC,
    status TEXT,
    similarity NUMERIC,
    composite_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_dev_status TEXT;
BEGIN
    SELECT compliance_status INTO v_dev_status
    FROM public.profiles
    WHERE id = p_developer_id;

    IF v_dev_status = 'SUSPENDED' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.description,
        d.budget,
        d.status,
        (1 - (d.embedding <=> p_query_embedding))::NUMERIC AS similarity,
        (
            ((1 - (d.embedding <=> p_query_embedding)) * 0.6) +
            ((p.reputation_score / 5.0) * 0.3) +
            ((LEAST(d.budget, 50000) / 50000.0) * 0.1)
        )::NUMERIC AS composite_score
    FROM public.demands d
    JOIN public.profiles p ON d.user_id = p.id
    WHERE d.status = 'PENDING'
      AND (1 - (d.embedding <=> p_query_embedding)) > p_similarity_threshold
      AND (v_dev_status != 'WARNED' OR (1 - (d.embedding <=> p_query_embedding)) > (p_similarity_threshold + 0.1))
    ORDER BY composite_score DESC
    LIMIT p_match_count;
END;
$$;
