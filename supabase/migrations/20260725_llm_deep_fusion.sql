-- LLM Deep Fusion: 4 new columns for contract documents, fulfillment snapshots

ALTER TABLE IF EXISTS public.contracts
  ADD COLUMN IF NOT EXISTS contract_doc_markdown TEXT,
  ADD COLUMN IF NOT EXISTS contract_doc_hash TEXT;

ALTER TABLE IF EXISTS public.credit_events
  ADD COLUMN IF NOT EXISTS sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  ADD COLUMN IF NOT EXISTS fulfillment_snapshot TEXT;
