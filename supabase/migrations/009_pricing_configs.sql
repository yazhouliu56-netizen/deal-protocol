-- M03: 定价配置表
CREATE TABLE IF NOT EXISTS pricing_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT UNIQUE NOT NULL REFERENCES category_configs(category),
  default_work_hours NUMERIC(5,2) DEFAULT 1.0,
  min_price NUMERIC(10,2) DEFAULT 0,
  warranty_months INTEGER,
  warranty_text TEXT,
  material_markup NUMERIC(5,2) DEFAULT 0,
  fixed_quote_max_minutes INTEGER DEFAULT 30,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pricing_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pricing_configs_select" ON pricing_configs;
CREATE POLICY "pricing_configs_select" ON pricing_configs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "pricing_configs_insert" ON pricing_configs;
CREATE POLICY "pricing_configs_insert" ON pricing_configs
  FOR INSERT WITH CHECK (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

DROP POLICY IF EXISTS "pricing_configs_update" ON pricing_configs;
CREATE POLICY "pricing_configs_update" ON pricing_configs
  FOR UPDATE USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));
