import { test } from "node:test";
import assert from "node:assert/strict";
import { diffNotifEvents, type NotifDiffInput } from "./systemNotify.ts";

const me = "me-1";
const wave = (id: string, status: string, capacity = 2) => ({
  id,
  authorId: me,
  status,
  capacity,
  basics: { category: "羽毛球约局" },
});

function frame(
  opts: {
    waves?: NotifDiffInput["waves"];
    claims?: NotifDiffInput["claims"];
    friends?: NotifDiffInput["friendRequests"];
  } = {}
): NotifDiffInput {
  return {
    meId: me,
    waves: opts.waves ?? [],
    claims: opts.claims ?? [],
    friendRequests: opts.friends ?? [],
  };
}

test("diff: 无变化 → 无通知", () => {
  const a = frame({ waves: [wave("w1", "active")] });
  assert.deepEqual(diffNotifEvents(a, a), []);
});

test("diff: 我的开放局首次拼满 → 成局通知", () => {
  const prev = frame({ waves: [wave("w1", "active")] });
  const next = frame({ waves: [wave("w1", "assembled")] });
  const out = diffNotifEvents(prev, next);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /拼满成局/);
});

test("diff: 别人的局成局不打扰", () => {
  const prev = frame({ waves: [{ ...wave("w9", "active"), authorId: "other" }] });
  const next = frame({ waves: [{ ...wave("w9", "assembled"), authorId: "other" }] });
  assert.deepEqual(diffNotifEvents(prev, next), []);
});

test("diff: 新报价（offered）→ 报价通知含金额", () => {
  const prev = frame({ waves: [wave("w1", "active", 1)] });
  const next = frame({
    waves: [wave("w1", "active", 1)],
    claims: [{ id: "c1", waveId: "w1", status: "offered", price: 88 }],
  });
  const out = diffNotifEvents(prev, next);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /新报价/);
  assert.match(out[0].body, /88/);
});

test("diff: 拼位占座（joined）→ 占座通知", () => {
  const prev = frame({ waves: [wave("w1", "active")] });
  const next = frame({
    waves: [wave("w1", "active")],
    claims: [{ id: "c2", waveId: "w1", status: "joined" }],
  });
  const out = diffNotifEvents(prev, next);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /拼位占座/);
});

test("diff: 单人局被正式接单 → 接单通知；开放局满员 accepted → 成局通知", () => {
  const solo = frame({ waves: [wave("w1", "active", 1)] });
  const soloNext = frame({
    waves: [wave("w1", "assembled", 1)],
    claims: [{ id: "c3", waveId: "w1", status: "accepted" }],
  });
  const soloOut = diffNotifEvents(solo, soloNext);
  assert.equal(soloOut.length, 1);
  assert.match(soloOut[0].title, /正式接单/);

  const open = frame({ waves: [wave("w1", "active", 2)] });
  const openNext = frame({
    waves: [wave("w1", "assembled", 2)],
    claims: [{ id: "c4", waveId: "w1", status: "accepted" }],
  });
  const openOut = diffNotifEvents(open, openNext);
  assert.equal(openOut.length, 2);
  assert.ok(openOut.every((n) => /成局/.test(n.title)));
});

test("diff: 新好友申请 → 好友通知；只发给我的", () => {
  const prev = frame();
  const next = frame({
    friends: [
      { id: "f1", toId: me, fromId: "u-2" },
      { id: "f2", toId: "someone-else", fromId: "u-3" },
    ],
  });
  const out = diffNotifEvents(prev, next);
  assert.equal(out.length, 1);
  assert.match(out[0].title, /好友申请/);
});

test("diff: 同一帧多类事件 → 全部产出且 id 稳定", () => {
  const prev = frame({ waves: [wave("w1", "active")] });
  const next = frame({
    waves: [wave("w1", "assembled")],
    claims: [{ id: "c5", waveId: "w1", status: "accepted" }],
    friends: [{ id: "f3", toId: me, fromId: "u-9" }],
  });
  const out = diffNotifEvents(prev, next);
  assert.equal(out.length, 3);
  assert.equal(out[0].id, "assembled:w1");
});