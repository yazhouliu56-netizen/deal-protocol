-- v3.9 批次1 · 漫游设备表运维加固（复合索引 + 90d 清理）
-- 宪法 #1 底座优先 #3 先表后码 #8 血液 #10 降级

-- 1) 复合索引：按 user 拉取按 last_seen 排序（GET /api/risk/roam/sync 热路径）
create index if not exists idx_roam_devices_user_last_seen
  on public.roam_devices(user_id, last_seen_at desc);

-- 2) 90 天过期设备物理清理函数（SECURITY DEFINER，硬删）
create or replace function public.cleanup_stale_roam_devices()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.roam_devices
  where last_seen_at < now() - interval '90 days';
end;
$$;
comment on function public.cleanup_stale_roam_devices() is 'v3.9 硬化：物理清理 90 天未活跃 roam_devices（硬删，配合 is_active 语义）';

-- 手动调度（Supabase pg_cron，需在 SQL Editor 另行执行）：
-- select cron.schedule('cleanup-roam-90d', '0 3 * * *', 'select public.cleanup_stale_roam_devices()');
-- select cron.unschedule('cleanup-roam-90d'); -- 如需取消
