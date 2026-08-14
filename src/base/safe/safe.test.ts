import { test } from "node:test";
import assert from "node:assert/strict";
import { crisisSms, notifyFor, raiseCrisis, resolveCrisis, type CrisisRecord } from "./crisis.ts";
import { anonymize, mask, requestForget, type ForgetRequest } from "./privacy.ts";

test("脱敏：手机号/姓名/地址/邮箱/身份证", () => {
  assert.equal(mask("phone", "13812345678"), "138****5678");
  assert.equal(mask("name", "张三"), "张**");
  assert.equal(mask("address", "浙江省杭州市西湖区"), "浙江****湖区");
  assert.equal(mask("email", "alice@example.com"), "al***@example.com");
  assert.equal(mask("id", "110101199003074512"), "110***********4512");
});

test("危机：级别 → 通知对象递增（EPA）", () => {
  let recs: CrisisRecord[] = [];
  const r = raiseCrisis(recs, "u1", 2, "约定地点失联", 1000, "w1");
  recs = r.records;
  const n1 = notifyFor(r.record, ["张三"]);
  assert.deepEqual(n1.targets, ["紧急联系人", "平台值班"]);
  assert.equal(crisisSms(n1.record, "张三").includes("提醒"), true);

  const n3 = raiseCrisis(recs, "u1", 3, "人身危险", 2000).record;
  const n3x = notifyFor(n3, ["张三"]);
  assert.ok(n3x.targets.includes("警方通道"));
});

test("危机：通知去重 + 处置闭环", () => {
  let recs: CrisisRecord[] = [];
  const { records, record } = raiseCrisis(recs, "u1", 1, "轻微不适", 1000);
  recs = records;
  const once = notifyFor(record, ["张三"]);
  const twice = notifyFor(once.record, ["张三"]);
  assert.equal(twice.fresh, false);
  const done = resolveCrisis(recs, record.id, 2000);
  assert.equal(done.find((r) => r.id === record.id)?.resolved, true);
});

test("遗忘权：请求幂等 + 匿名化删字段", () => {
  let reqs: ForgetRequest[] = [];
  const r1 = requestForget(reqs, "u1", "profile", 1000);
  reqs = r1.requests;
  assert.equal(r1.fresh, true);
  const r2 = requestForget(reqs, "u1", "profile", 2000);
  assert.equal(r2.fresh, false);

  const anon = anonymize({ nickname: "Alex", avatar: "x", tags: ["a"], phone: "138" }, "profile");
  assert.equal(anon.nickname, undefined);
  assert.equal(anon.phone, undefined);
  assert.equal(anonymize({ waves: [1], reviews: [2] }, "all").waves, undefined);
});