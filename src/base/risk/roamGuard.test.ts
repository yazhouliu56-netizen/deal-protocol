import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bind,
  buildDeviceBindingIndex,
  extraLogin,
  makeDeviceId,
  riskOf,
  roam,
  ROAM_RULES,
  DEFAULT_ROAM_PARAMS,
  type DeviceBinding,
  type RoamRuleParams,
} from "./roamGuard.ts";

const T0 = 1750000000000;

const bindings: DeviceBinding[] = [
  { deviceId: "dev-a", identityId: "me-1", firstSeen: T0, lastSeen: T0 },
];

test("makeDeviceId: deterministic for same ua+seed", () => {
  const a = makeDeviceId("UA/1 test", "salt-1");
  const b = makeDeviceId("UA/1 test", "salt-1");
  const c = makeDeviceId("UA/2 test", "salt-1");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^dev-[0-9a-f]{8}$/);
});

test("riskOf: single identity → safe", () => {
  const r = riskOf(bindings, "dev-a");
  assert.equal(r.risk, "safe");
  assert.equal(r.count, 1);
});

test("riskOf: family threshold (2) → watch, not punish", () => {
  const both: DeviceBinding[] = [
    ...bindings,
    { deviceId: "dev-a", identityId: "me-2", firstSeen: T0, lastSeen: T0 },
  ];
  const r = riskOf(both, "dev-a");
  assert.equal(r.risk, "watch");
  assert.equal(r.count, ROAM_RULES.maxPerDeviceForFamily);
});

test("riskOf: ≥3 identities → high (suspected multi-account)", () => {
  const many: DeviceBinding[] = [
    ...bindings,
    { deviceId: "dev-a", identityId: "me-2", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "me-3", firstSeen: T0, lastSeen: T0 },
  ];
  const r = riskOf(many, "dev-a");
  assert.equal(r.risk, "high");
  assert.equal(r.count, ROAM_RULES.freezeAt);
});

test("bind: idempotent re-bind only bumps lastSeen", () => {
  const first = bind(bindings, "dev-a", "me-1", T0 + 10);
  assert.equal(first.fresh, false);
  assert.equal(first.bindings.length, 1);
  assert.equal(first.bindings[0].lastSeen, T0 + 10);
});

test("roam: identity leaves old device, enters new one", () => {
  const { bindings: next, event } = roam(bindings, "dev-a", "dev-b", "me-1", T0 + 1);
  assert.equal(next.length, 1);
  assert.equal(next[0].deviceId, "dev-b");
  assert.equal(event.kind, "roam");
  assert.ok(event.note.includes("dev-a → dev-b"));
  const r = riskOf(next, "dev-a");
  assert.equal(r.count, 0);
});

test("extraLogin: second identity on same device escalates to watch alert", () => {
  const out = extraLogin(bindings, "dev-a", "me-2", T0 + 1);
  assert.equal(out.bindings.length, 2);
  assert.equal(out.risk, "watch");
  assert.equal(out.event.kind, "alert");
});

test("extraLogin: third identity → high alert", () => {
  let b = [...bindings];
  b = extraLogin(b, "dev-a", "me-2", T0 + 1).bindings;
  const third = extraLogin(b, "dev-a", "me-3", T0 + 2);
  assert.equal(third.risk, "high");
  assert.equal(third.event.kind, "alert");
});

test("ammo 引信参数：收紧 warnThreshold=1 → 2 身份即 high（引信跟弹药走）", () => {
  const tight: RoamRuleParams = { warnThreshold: 1, freezeThreshold: 2 };
  const both: DeviceBinding[] = [
    ...bindings,
    { deviceId: "dev-a", identityId: "me-2", firstSeen: T0, lastSeen: T0 },
  ];
  const r = riskOf(both, "dev-a", tight);
  assert.equal(r.risk, "high", "收紧阈值后 2 身份即判多开");
});

test("ammo 引信参数：放松 warnThreshold=4 → 4 身份仍 watch", () => {
  const loose: RoamRuleParams = { warnThreshold: 4, freezeThreshold: 5 };
  const many: DeviceBinding[] = [
    ...bindings,
    { deviceId: "dev-a", identityId: "me-2", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "me-3", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "me-4", firstSeen: T0, lastSeen: T0 },
  ];
  const r = riskOf(many, "dev-a", loose);
  assert.equal(r.risk, "watch");
});

test("DEFAULT_ROAM_PARAMS 与 ROAM_RULES 常量等价（历史行为不变）", () => {
  assert.equal(DEFAULT_ROAM_PARAMS.warnThreshold, ROAM_RULES.maxPerDeviceForFamily);
  assert.equal(DEFAULT_ROAM_PARAMS.freezeThreshold, ROAM_RULES.freezeAt);
});

test("buildDeviceBindingIndex: 空集合 => 空 Map", () => {
  const idx = buildDeviceBindingIndex([]);
  assert.equal(idx.size, 0);
  assert.equal(riskOf([], "dev-a", DEFAULT_ROAM_PARAMS, idx).count, 0);
  assert.equal(riskOf([], "dev-a", DEFAULT_ROAM_PARAMS, idx).risk, "safe");
});

test("buildDeviceBindingIndex: 多设备聚合正确", () => {
  const many: DeviceBinding[] = [
    { deviceId: "dev-a", identityId: "u1", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "u2", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-b", identityId: "u3", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "u4", firstSeen: T0, lastSeen: T0 },
  ];
  const idx = buildDeviceBindingIndex(many);
  assert.equal(idx.get("dev-a"), 3);
  assert.equal(idx.get("dev-b"), 1);
  assert.equal(idx.get("dev-c"), undefined);
});

test("riskOf 索引与遍历字节级等价（同参同结果）", () => {
  const many: DeviceBinding[] = [
    { deviceId: "dev-a", identityId: "u1", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "u2", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-b", identityId: "u3", firstSeen: T0, lastSeen: T0 },
    { deviceId: "dev-a", identityId: "u4", firstSeen: T0, lastSeen: T0 },
  ];
  const idx = buildDeviceBindingIndex(many);
  for (const did of ["dev-a", "dev-b", "dev-x"]) {
    const viaIndex = riskOf(many, did, DEFAULT_ROAM_PARAMS, idx);
    const viaScan = riskOf(many, did);
    assert.deepEqual(viaIndex, viaScan, `device ${did} 等价`);
  }
  const tight: RoamRuleParams = { warnThreshold: 1, freezeThreshold: 2 };
  const idx2 = buildDeviceBindingIndex(many);
  assert.deepEqual(
    riskOf(many, "dev-a", tight, idx2),
    riskOf(many, "dev-a", tight),
    "引信参数下亦等价"
  );
});

test("riskOf 可选 index 向后兼容：缺省与显式均一致", () => {
  const both: DeviceBinding[] = [
    ...bindings,
    { deviceId: "dev-a", identityId: "me-2", firstSeen: T0, lastSeen: T0 },
  ];
  const idx = buildDeviceBindingIndex(both);
  assert.equal(riskOf(both, "dev-a").risk, "watch");
  assert.equal(riskOf(both, "dev-a", DEFAULT_ROAM_PARAMS, idx).risk, "watch");
  assert.equal(riskOf(both, "dev-a", DEFAULT_ROAM_PARAMS, idx).count, 2);
});

test("buildDeviceBindingIndex 纯函数确定性（同入同出，无突变）", () => {
  const src: DeviceBinding[] = [
    { deviceId: "dev-a", identityId: "u1", firstSeen: T0, lastSeen: T0 },
  ];
  const a = buildDeviceBindingIndex(src);
  const b = buildDeviceBindingIndex(src);
  assert.notEqual(a, b, "每次返回新 Map 实例");
  assert.deepEqual([...a.entries()], [...b.entries()]);
  assert.equal(src.length, 1, "入参零突变");
});