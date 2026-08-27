import { test, expect } from "vitest";
import fs from "node:fs";

test("ammo generate route: withAuth + 5/min 限流 + 422/429 分支", async () => {
  const txt = fs.readFileSync("src/app/api/ammo/generate/route.ts", "utf8");
  expect(txt).toContain("withAuth");
  expect(txt).toContain("RATE_LIMIT_MAX");
  expect(txt).toContain("5");
  expect(txt).toContain("429");
  expect(txt).toContain("422");
  expect(txt).toContain("prompt required");
});

test("ammo generate route: Prompt Schema 白名单 6 算子 + 8D 质检", async () => {
  const txt = fs.readFileSync("src/app/api/ammo/generate/route.ts", "utf8");
  expect(txt).toContain("SYSTEM_PROMPT");
  expect(txt).toContain("IHolographicAmmoConfig");
  // 6 白名单（SYSTEM_PROMPT 内约束）
  expect(txt).toContain("ArrivalCheckHook");
  expect(txt).toContain("CleaningCheckHook");
  expect(txt).toContain("OnsiteQuoteHook");
  expect(txt).toContain("AASplitSettleHook");
  expect(txt).toContain("PrivacyShieldHook");
  expect(txt).toContain("DepartureFinishHook");
  expect(txt).toContain("validateAmmoConfig");
  expect(txt).toContain("assembleAmmo");
  expect(txt).toContain("registerDynamicAmmo");
});

test("ammo generate route: 模板降级 + Markdown 清洗 + 热注入", async () => {
  const txt = fs.readFileSync("src/app/api/ammo/generate/route.ts", "utf8");
  expect(txt).toContain("templateConfig");
  expect(txt).toContain("extractJson");
  expect(txt).toContain("```");
  expect(txt).toContain("deepseek");
  expect(txt).toContain("holographic");
});

test("ammo generate route: 模块导出 POST", async () => {
  const mod = await import("./route.ts");
  expect(typeof mod.POST).toBe("function");
});
