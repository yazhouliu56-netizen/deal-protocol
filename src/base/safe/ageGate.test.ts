import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AGE,
  ageFromBirthYear,
  ageGate,
  categoryRequiresAdult,
  isPaidPublish,
  modeOfAge,
} from "./ageGate.ts";
import {
  addWindow,
  inAnyWindow,
  minuteOfWeek,
  removeWindow,
  shouldNotify,
  type QuietPref,
} from "../platform/quietHours.ts";

test("ageGate 成年全放行", () => {
  assert.equal(ageGate({ age: 25, action: "bidding" }).blocked, false);
  assert.equal(ageGate({ age: 18, action: "escrow-settle" }).blocked, false);
});

test("ageGate 儿童(<14)无监护人同意全拦含浏览", () => {
  const r = ageGate({ age: 12, action: "browse" });
  assert.equal(r.blocked, true);
  assert.equal(r.mode, "child");
});

test("ageGate 儿童有监护人同意 → 仅浏览放行、发布/响应/资金全拦", () => {
  assert.equal(ageGate({ age: 12, action: "browse", guardianConsent: true }).blocked, false);
  assert.equal(ageGate({ age: 12, action: "publish", guardianConsent: true }).blocked, true);
  assert.equal(ageGate({ age: 12, action: "respond", guardianConsent: true }).blocked, true);
  assert.equal(ageGate({ age: 12, action: "deposit", guardianConsent: true }).blocked, true);
});

test("ageGate 青少年(14-17)免费放行、资金全拦", () => {
  assert.equal(ageGate({ age: 15, action: "publish" }).blocked, false);
  assert.equal(ageGate({ age: 16, action: "respond" }).blocked, false);
  assert.equal(ageGate({ age: 17, action: "insurance" }).blocked, true);
  assert.equal(ageGate({ age: 14, action: "publish-fee" }).blocked, true);
});

test("ageGate 资金闸不因 guardMode=false 解除", () => {
  assert.equal(ageGate({ age: 16, action: "bidding", guardMode: false }).blocked, true);
});

test("modeOfAge / ageFromBirthYear 边界", () => {
  assert.equal(modeOfAge(13), "child");
  assert.equal(modeOfAge(14), "teen");
  assert.equal(modeOfAge(18), "adult");
  assert.equal(ageFromBirthYear(2012, 2026), 14);
  assert.equal(ageFromBirthYear(2030, 2026), 0);
  assert.equal(AGE.childMax, 13);
  assert.equal(AGE.teenMax, 17);
});

test("isPaidPublish 免费次数内免费、用尽付费", () => {
  assert.equal(isPaidPublish(3), false);
  assert.equal(isPaidPublish(0), true);
  assert.equal(isPaidPublish(-1), true);
});

test("categoryRequiresAdult 弹药引信类目判定", () => {
  assert.equal(categoryRequiresAdult("夜骑巡航", ["夜骑巡航"]), true);
  assert.equal(categoryRequiresAdult("羽毛球约局", ["夜骑巡航"]), false);
});

test("quietHours urgent 不受免打扰影响", () => {
  const pref: QuietPref = { enabled: true, windows: [{ start: 0, end: 10080 }] };
  assert.equal(shouldNotify("urgent", pref, 300), true);
});

test("quietHours normal 窗口内静音、窗外推送、disabled 全推", () => {
  const pref: QuietPref = { enabled: true, windows: [{ start: 120, end: 240 }] };
  assert.equal(shouldNotify("normal", pref, 150), false);
  assert.equal(shouldNotify("normal", pref, 300), true);
  assert.equal(shouldNotify("normal", { ...pref, enabled: false }, 150), true);
});

test("quietHours 跨午夜窗口（22:00→06:00）", () => {
  const pref: QuietPref = { enabled: true, windows: [{ start: 1320, end: 360 }] };
  assert.equal(shouldNotify("normal", pref, 1400), false); // 23:20
  assert.equal(shouldNotify("normal", pref, 100), false); // 01:40
  assert.equal(shouldNotify("normal", pref, 720), true); // 12:00
});

test("minuteOfWeek 取模一周", () => {
  const weekStart = 1_700_000_000_000;
  assert.equal(minuteOfWeek(weekStart, weekStart), 0);
  assert.equal(minuteOfWeek(weekStart + 60_000, weekStart), 1);
  assert.equal(minuteOfWeek(weekStart + 10080 * 60_000, weekStart), 0);
});

test("inAnyWindow 多窗口任一命中", () => {
  assert.equal(inAnyWindow(500, [{ start: 100, end: 200 }, { start: 400, end: 600 }]), true);
  assert.equal(inAnyWindow(300, [{ start: 100, end: 200 }, { start: 400, end: 600 }]), false);
});

test("addWindow 合并相邻/重叠", () => {
  const p1 = addWindow({ enabled: true, windows: [] }, { start: 100, end: 200 });
  const p2 = addWindow(p1, { start: 200, end: 300 });
  assert.deepEqual(p2.windows, [{ start: 100, end: 300 }]);
  const p3 = addWindow(p2, { start: 250, end: 350 });
  assert.deepEqual(p3.windows, [{ start: 100, end: 350 }]);
});

test("addWindow 全周覆盖退化为 disabled", () => {
  const p = addWindow({ enabled: true, windows: [] }, { start: 0, end: 10080 });
  assert.equal(p.enabled, false);
});

test("removeWindow 拆分 gap", () => {
  const pref: QuietPref = { enabled: true, windows: [{ start: 0, end: 1000 }] };
  const p = removeWindow(pref, { start: 400, end: 600 });
  assert.deepEqual(p.windows, [{ start: 0, end: 400 }, { start: 600, end: 1000 }]);
});
