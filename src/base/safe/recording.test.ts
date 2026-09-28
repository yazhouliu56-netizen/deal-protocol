import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideAutoStart,
  decideStop,
  isRetentionExpired,
  retentionDaysFor,
} from "./recording.ts";

test("留存矩阵（R-0928-09）：A30/B7/纠纷30/篡改90/C归零", () => {
  assert.equal(retentionDaysFor("A", "clean"), 30);
  assert.equal(retentionDaysFor("B", "clean"), 7);
  assert.equal(retentionDaysFor("A", "disputed"), 30);
  assert.equal(retentionDaysFor("B", "disputed"), 30);
  assert.equal(retentionDaysFor("A", "tampered"), 90);
  assert.equal(retentionDaysFor("B", "tampered"), 90);
  assert.equal(retentionDaysFor("C", "clean"), 0);
  assert.equal(retentionDaysFor("C", "disputed"), 0);
});

test("自动触发：仅 A＋已授权＋到节点才开", () => {
  assert.deepEqual(decideAutoStart({ tier: "A", authorized: true, atHighRiskNode: true }), {
    start: true,
    reason: "tier-a-authorized-node",
  });
  assert.equal(decideAutoStart({ tier: "A", authorized: false, atHighRiskNode: true }).start, false);
  assert.equal(decideAutoStart({ tier: "A", authorized: true, atHighRiskNode: false }).start, false);
  assert.deepEqual(decideAutoStart({ tier: "B", authorized: true, atHighRiskNode: true }), {
    start: false,
    reason: "tier-b-manual-only",
  });
  assert.deepEqual(decideAutoStart({ tier: "C", authorized: true, atHighRiskNode: true }), {
    start: false,
    reason: "tier-c-forbidden",
  });
});

test("停止语义：A 档手动关＝拒绝＋TAMPER；B 档手动关＝封存；非录音 noop", () => {
  assert.deepEqual(decideStop({ tier: "A", state: "RECORDING", manual: true }), {
    action: "deny",
    reason: "tier-a-locked",
    tamper: true,
  });
  assert.deepEqual(decideStop({ tier: "A", state: "RECORDING", manual: false }), {
    action: "seal",
    reason: "auto-seal",
    tamper: false,
  });
  assert.deepEqual(decideStop({ tier: "B", state: "RECORDING", manual: true }), {
    action: "seal",
    reason: "manual-seal",
    tamper: false,
  });
  assert.deepEqual(decideStop({ tier: "B", state: "IDLE", manual: true }), {
    action: "noop",
    reason: "not-recording",
    tamper: false,
  });
});

test("到期销毁：边界非法输入永不过期（fail-closed 反向：不过期≠删除）", () => {
  const sealed = 1_800_000_000_000;
  assert.equal(isRetentionExpired(sealed, "B", "clean", sealed + 8 * 86_400_000), true);
  assert.equal(isRetentionExpired(sealed, "B", "clean", sealed + 6 * 86_400_000), false);
  assert.equal(isRetentionExpired(sealed, "C", "clean", sealed), true);
  assert.equal(isRetentionExpired(NaN, "A", "clean", sealed), false);
});
