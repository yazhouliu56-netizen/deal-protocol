ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified','pending','approved','rejected'));

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_real_name TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_id_number TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_certificates JSONB DEFAULT '[]'::jsonb;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_rejected_reason TEXT;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_submitted_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_reviewed_at TIMESTAMPTZ;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verification_reviewed_by UUID REFERENCES profiles(id);
