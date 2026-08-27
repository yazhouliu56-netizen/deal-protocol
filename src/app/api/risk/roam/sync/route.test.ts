import { test, expect } from "vitest";
import fs from "node:fs";

test("roam sync route: module exports GET and POST", async () => {
  const mod = await import("./route.ts");
  expect(typeof mod.GET).toBe("function");
  expect(typeof mod.POST).toBe("function");
});

test("roam sync route: DDL file exists with UUID FK and RLS", async () => {
  const txt = fs.readFileSync("supabase/migrations/20260827_roam_devices.sql", "utf8");
  expect(txt).toContain("user_id uuid not null references auth.users");
  expect(txt).toContain("primary key (user_id, device_id)");
  expect(txt).toContain("roam_devices_select_own");
  expect(txt).toContain("roam_devices_no_direct_write");
  expect(txt).toContain("ip_hash");
});

test("roam hardening DDL: composite index + 90d cleanup function", async () => {
  const txt = fs.readFileSync("supabase/migrations/20260828_roam_hardening.sql", "utf8");
  expect(txt).toContain("idx_roam_devices_user_last_seen");
  expect(txt).toContain("cleanup_stale_roam_devices");
  expect(txt).toContain("90 days");
  expect(txt).toContain("security definer");
});

test("roam sync route: 10/min 限流 + E2E_BYPASS + 60s 去重窗口", async () => {
  const txt = fs.readFileSync("src/app/api/risk/roam/sync/route.ts", "utf8");
  expect(txt).toContain("RATE_LIMIT_MAX");
  expect(txt).toContain("E2E_BYPASS_RATELIMIT");
  expect(txt).toContain("x-e2e-bypass");
  expect(txt).toContain("429");
  expect(txt).toContain("60_000");
  expect(txt).toContain("roam_risk_events");
  expect(txt).toContain("created_at");
});
