const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const pwd = process.env.PGPASS;
if (!pwd) { console.error('Missing PGPASS'); process.exit(1); }

async function exec(c, label, sql) {
  try { await c.query(sql); console.log('  OK:', label); return true; }
  catch(e) {
    const m = e.message || '';
    if (m.includes('already exists')) { console.log('  SKIP:', label); return false; }
    console.error('  FAIL:', label, '-', m.substring(0,120));
    return false;
  }
}

async function main() {
  const c = new Client({
    user: 'postgres.eixqnwaxcnwtxiizmdfs',
    password: pwd,
    host: 'aws-0-ap-northeast-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
    statement_timeout: 120000,
  });
  await c.connect();
  console.log('Connected.');

  // Create role if not exists
  await exec(c, 'bandit_reader role',
    "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bandit_reader') THEN CREATE ROLE bandit_reader; END IF; END $$;"
  );

  // Extensions
  await exec(c, 'vector ext', 'CREATE EXTENSION IF NOT EXISTS vector');
  await exec(c, 'postgis ext', 'CREATE EXTENSION IF NOT EXISTS postgis');

  // Tables
  await exec(c, 'users', `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT UNIQUE NOT NULL, nickname TEXT, avatar_url TEXT,
    role TEXT NOT NULL CHECK (role IN ('demander','provider','both')),
    identity_verified BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT),
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'category_configs', `CREATE TABLE IF NOT EXISTS category_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT UNIQUE NOT NULL,
    risk_tier TEXT NOT NULL CHECK (risk_tier IN ('low','medium','high')),
    schema_json JSONB NOT NULL, entry_requirements JSONB,
    response_mode TEXT NOT NULL CHECK (response_mode IN ('grab_first','interest_list','agency_dispatch')),
    safety_requirements JSONB,
    team_formation_enabled BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT FALSE, version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'protocols', `CREATE TABLE IF NOT EXISTS protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    demander_id UUID REFERENCES users(id),
    provider_id UUID REFERENCES users(id),
    category TEXT NOT NULL, core_fields JSONB NOT NULL,
    category_fields JSONB NOT NULL, embedding VECTOR(1024),
    location GEOGRAPHY(POINT), response_mode TEXT NOT NULL,
    risk_tier TEXT NOT NULL,
    funding_mode TEXT DEFAULT 'full_prepay',
    origin_type TEXT DEFAULT 'platform_client',
    status TEXT DEFAULT 'draft',
    final_price NUMERIC(10,2), created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'provider_qualifications', `CREATE TABLE IF NOT EXISTS provider_qualifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id), category TEXT NOT NULL,
    qualification_type TEXT NOT NULL, qualification_ref TEXT,
    verified BOOLEAN DEFAULT FALSE, expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category, qualification_type)
  )`);

  await exec(c, 'provider_categories', `CREATE TABLE IF NOT EXISTS provider_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id), category TEXT NOT NULL,
    skills TEXT[] DEFAULT '{}', is_online BOOLEAN DEFAULT FALSE,
    current_location GEOGRAPHY(POINT),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category)
  )`);

  await exec(c, 'credit_records', `CREATE TABLE IF NOT EXISTS credit_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    base_score NUMERIC(5,2) DEFAULT 60,
    base_verified_status TEXT DEFAULT 'pending',
    base_fulfillment_rate NUMERIC(5,2),
    base_violation_count INT DEFAULT 0,
    base_total_deals INT DEFAULT 0, category TEXT,
    category_score NUMERIC(5,2),
    category_order_count INT DEFAULT 0,
    category_repurchase_rate NUMERIC(5,2),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, category),
    CONSTRAINT valid_base_score CHECK (base_score >= 0 AND base_score <= 100)
  )`);

  await exec(c, 'orders', `CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES protocols(id),
    provider_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'grabbed',
    service_phase TEXT DEFAULT 'NOT_ACCEPTED',
    amount NUMERIC(10,2),
    escrow_status TEXT DEFAULT 'pending',
    platform_fee NUMERIC(10,2),
    provider_income NUMERIC(10,2),
    satisfaction_hold NUMERIC(10,2),
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'evidence_log', `CREATE TABLE IF NOT EXISTS evidence_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol_id UUID REFERENCES protocols(id),
    order_id UUID REFERENCES orders(id),
    event_type TEXT NOT NULL, payload JSONB NOT NULL,
    payload_ref TEXT, captured_by UUID REFERENCES users(id),
    hash TEXT, prev_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'credit_events', `CREATE TABLE IF NOT EXISTS credit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) NOT NULL,
    dimension TEXT NOT NULL, category TEXT,
    previous_score NUMERIC(5,2), new_score NUMERIC(5,2),
    delta NUMERIC(5,2) NOT NULL, reason TEXT NOT NULL,
    evidence_id UUID REFERENCES evidence_log(id),
    triggered_by TEXT NOT NULL,
    protocol_id UUID REFERENCES protocols(id),
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'guarantee_links', `CREATE TABLE IF NOT EXISTS guarantee_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guarantor_id UUID REFERENCES users(id) NOT NULL,
    guaranteed_id UUID REFERENCES users(id) NOT NULL,
    guarantee_type TEXT NOT NULL,
    stake_amount NUMERIC(10,2) DEFAULT 0,
    max_liability NUMERIC(10,2),
    status TEXT NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'precedents', `CREATE TABLE IF NOT EXISTS precedents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary TEXT NOT NULL, key_factors JSONB NOT NULL,
    ruling_principle TEXT NOT NULL, embedding VECTOR(1536),
    binding BOOLEAN DEFAULT TRUE, arbitration_case_id UUID,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT now()
  )`);

  await exec(c, 'bandit_stats', `CREATE TABLE IF NOT EXISTS bandit_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID REFERENCES users(id), category TEXT,
    impressions INT DEFAULT 0, clicks INT DEFAULT 0,
    conversions INT DEFAULT 0, reward_sum NUMERIC(10,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(provider_id, category)
  )`);

  // Indexes
  for (const idx of [
    'CREATE INDEX IF NOT EXISTS idx_providers_location ON provider_categories USING GIST(current_location)',
    'CREATE INDEX IF NOT EXISTS idx_protocols_location ON protocols USING GIST(location)',
    'CREATE INDEX IF NOT EXISTS idx_provider_category ON provider_categories(category)',
    'CREATE INDEX IF NOT EXISTS idx_evidence_log_protocol ON evidence_log(protocol_id)',
    'CREATE INDEX IF NOT EXISTS idx_credit_events_user ON credit_events(user_id, created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_links_guarantor ON guarantee_links(guarantor_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_guarantee_links_guaranteed ON guarantee_links(guaranteed_id, status)',
    'CREATE INDEX IF NOT EXISTS idx_bandit_stats_provider ON bandit_stats(provider_id, category)',
  ]) { await exec(c, 'index', idx); }

  // RLS enables
  for (const t of ['users','protocols','orders','credit_records','evidence_log','provider_categories']) {
    await c.query('ALTER TABLE ' + t + ' ENABLE ROW LEVEL SECURITY').catch(()=>{});
  }
  console.log('  OK: RLS enables');

  // Grant perms
  await c.query('GRANT SELECT ON orders, protocols, bandit_stats TO bandit_reader').catch(()=>{});

  // Policies
  for (const p of [
    'CREATE POLICY IF NOT EXISTS "users_view_self" ON users FOR SELECT USING (id = auth.uid())',
    'CREATE POLICY IF NOT EXISTS "protocols_select" ON protocols FOR SELECT USING (demander_id = auth.uid() OR provider_id = auth.uid() OR (status = \'matching\'))',
    'CREATE POLICY IF NOT EXISTS "credit_records_select" ON credit_records FOR SELECT USING (user_id = auth.uid() OR auth.uid() IN (SELECT id FROM users WHERE role = \'admin\'))',
    'CREATE POLICY IF NOT EXISTS "credit_records_no_insert" ON credit_records FOR INSERT WITH CHECK (false)',
    'CREATE POLICY IF NOT EXISTS "credit_records_no_update" ON credit_records FOR UPDATE USING (false)',
    'CREATE POLICY IF NOT EXISTS "evidence_log_insert" ON evidence_log FOR INSERT WITH CHECK (true)',
    'CREATE POLICY IF NOT EXISTS "evidence_log_select" ON evidence_log FOR SELECT USING (true)',
    'CREATE POLICY IF NOT EXISTS "evidence_log_no_update" ON evidence_log FOR UPDATE USING (false)',
    'CREATE POLICY IF NOT EXISTS "evidence_log_no_delete" ON evidence_log FOR DELETE USING (false)',
  ]) { await exec(c, 'policy', p); }

  console.log('001_schema complete. Running remaining migration files...');
  await c.end();

  // Run remaining migration files
  const remaining = [
    '002_create_user_fn.sql', '003_credit_dimensions.sql',
    '004_team_formation.sql', '005_match_providers_nearby.sql',
    '006_add_rejected_status.sql', '007_rls_team_visibility.sql',
    '008_protocol_meta.sql', '009_pricing_configs.sql',
    'seed_categories.sql',
  ];
  const dir = 'D:\\Users\\Administrator\\Desktop\\deal-protocol\\supabase\\migrations';
  for (const f of remaining) {
    const fp = path.join(dir, f);
    if (!fs.existsSync(fp)) continue;
    const c2 = new Client({
      user: 'postgres.eixqnwaxcnwtxiizmdfs',
      password: pwd,
      host: 'aws-0-ap-northeast-1.pooler.supabase.com',
      port: 6543, database: 'postgres',
      ssl: { rejectUnauthorized: false }, statement_timeout: 120000,
    });
    await c2.connect();
    const sql = fs.readFileSync(fp, 'utf8').trim();
    try {
      await c2.query(sql);
      console.log('  OK:', f);
    } catch(e) {
      const m = e.message || '';
      if (m.includes('already exists') || m.includes('duplicate') || m.includes('already been applied')) {
        console.log('  SKIP:', f, '-', m.substring(0,60));
      } else {
        console.log('  ISSUE:', f, '-', m.substring(0,120));
      }
    }
    await c2.end();
  }

  console.log('All migrations complete!');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
