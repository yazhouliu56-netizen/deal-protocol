-- Direction A · P8 Roam — roam_devices + roam_risk_events (UUID FK + 双保险 RLS)
-- 对齐 mvp_core_tables.sql: users(id UUID PK) 10 表体系
-- 宪法 #1 底座优先（纯函数核） #3 先表后码 #8 隐私血液 #10 降级

create extension if not exists "pgcrypto";

-- 1) 用户设备指纹注册表（复合主键防伪造，ip_hash 脱敏）
create table if not exists public.roam_devices (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  fingerprint jsonb not null default '{}'::jsonb,
  user_agent text,
  ip_hash text,
  last_seen_at timestamptz not null default now(),
  risk_level text not null default 'safe' check (risk_level in ('safe','watch','high')),
  is_active boolean not null default true,
  primary key (user_id, device_id)
);
create index if not exists idx_roam_devices_user on public.roam_devices(user_id);
create index if not exists idx_roam_devices_last_seen on public.roam_devices(last_seen_at);
comment on table public.roam_devices is 'P8 roam: (user_id,device_id) PK, fingerprint JSONB 脱敏, ip_hash sha256, last_seen_at TTL 90d';

-- 2) 多开/漫游风控审计日志（仅 Service Role 写）
create table if not exists public.roam_risk_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  event_type text not null check (event_type in ('MULTI_DEVICE_LOGIN','IP_ANOMALY','DEVICE_BLOCKED','ROAM')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_roam_events_user on public.roam_risk_events(user_id, created_at desc);
create index if not exists idx_roam_events_device on public.roam_risk_events(device_id);
comment on table public.roam_risk_events is 'P8 roam audit: high 风险自动写盘, service_role only';

-- 3) RLS 双保险：用户只读自身，写一律 Service Role 经 API
alter table public.roam_devices enable row level security;
alter table public.roam_risk_events enable row level security;

drop policy if exists "roam_devices_select_own" on public.roam_devices;
create policy "roam_devices_select_own" on public.roam_devices
  for select using (auth.uid() = user_id);
drop policy if exists "roam_devices_no_direct_write" on public.roam_devices;
create policy "roam_devices_no_direct_write" on public.roam_devices
  for all using (false) with check (false);

drop policy if exists "roam_events_no_direct" on public.roam_risk_events;
create policy "roam_events_no_direct" on public.roam_risk_events
  for all using (false) with check (false);
-- service_role bypass RLS 经 /api/risk/roam/sync 写入

-- 4) 90d TTL 清理（pg_cron 或 API 定时）
-- delete from public.roam_devices where last_seen_at < now() - interval '90 days';
