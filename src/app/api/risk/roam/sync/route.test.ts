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
