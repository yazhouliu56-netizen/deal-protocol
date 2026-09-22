/**
 * 冻结账本门禁阴性对照（P9 缺口补考卷 · 用户裁决 2026-09-23）。
 *
 * check-frozen-ledgers.mjs 之前只有阳性实证（干净树 PASS）；
 * 本卷用 fixture 目录证明它真能抓到违规（阴性对照），防门禁静默失效。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(
  new URL("../../../scripts/check-frozen-ledgers.mjs", import.meta.url),
);

function runOn(dir: string) {
  return spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
}

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "frozen-"));
  for (const [name, content] of Object.entries(files)) {
    const p = join(dir, name);
    mkdirSync(join(dir), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

test("阴性对照：profiles.balance 写入被拦截（exit 1）", () => {
  const dir = fixture({
    "a.ts": `
      const r = await supabase.from('profiles').update({ balance: 1 }).eq('id', 'u1');
    `,
  });
  try {
    const r = runOn(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /frozen-ledger/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("阴性对照：platform_fee 类型写入被拦截（exit 1）", () => {
  const dir = fixture({ "b.ts": `await svc.from("transactions").insert({ type: 'platform_fee' })` });
  try {
    const r = runOn(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /platform_fee/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("阳性对照：干净目录放行（exit 0）", () => {
  const dir = fixture({
    "c.ts": `await svc.from("wallets").select("balance").eq("id", "w1");`,
  });
  try {
    const r = runOn(dir);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /PASS/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("脚本本体可执行（冒烟，保持 node 检索路径有效）", () => {
  assert.doesNotThrow(() =>
    execFileSync(process.execPath, ["--check", SCRIPT]),
  );
});
