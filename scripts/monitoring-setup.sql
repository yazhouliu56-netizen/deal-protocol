-- Monitoring & Observability Schema
-- Run this in your Supabase SQL editor after initial schema setup.

create table if not exists metrics (
  id bigint generated always as identity primary key,
  name text not null,
  value numeric not null,
  tags jsonb default '{}',
  recorded_at timestamptz not null default now()
);

create index if not exists idx_metrics_name on metrics (name);
create index if not exists idx_metrics_recorded_at on metrics (recorded_at desc);

create table if not exists cron_jobs (
  id bigint generated always as identity primary key,
  name text not null unique,
  schedule text not null,
  last_run_at timestamptz,
  next_run_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'paused', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  type text not null default 'info' check (type in ('info', 'warning', 'error', 'success')),
  metadata jsonb default '{}',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications (user_id, is_read, created_at desc);

create table if not exists emergency_contacts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  phone text not null,
  relationship text,
  priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_emergency_contacts_user on emergency_contacts (user_id, priority desc);
