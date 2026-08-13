import { test } from "node:test";
import assert from "node:assert/strict";
import {
  allocatePair,
  DEMO_POOL,
  dialInNumber,
  findSession,
  maskNumber,
  minutesLeft,
  revokeSession,
  type PrivacySession,
} from "./privacyNumber.ts";
import {
  ensureThread,
  keyOf,
  markRead,
  sendMsg,
  threadMessages,
  unreadTotal,
} from "./im.ts";

test("幂等分配：同一 wave 复用同一会话，不重复占用号码", () => {
  const s: PrivacySession[] = [];
  const r1 = allocatePair(s, DEMO_POOL, "w1", "a", "b", 1000);
  const r2 = allocatePair(r1.sessions, DEMO_POOL, "w1", "a", "b", 2000);
  assert.equal(r2.fresh, false);
  assert.equal(r2.session.aNumber, r1.session.aNumber);
  assert.equal(s.length, 0);
});

test("不同 wave 分配不同号码对", () => {
  const r1 = allocatePair([], DEMO_POOL, "w1", "a", "b", 1000);
  const r2 = allocatePair(r1.sessions, DEMO_POOL, "w2", "a", "b", 1000);
  assert.notEqual(r2.session.aNumber, r1.session.aNumber);
});

test("掩码：11 位号隐藏中间四位（138****0001）", () => {
  assert.equal(maskNumber("138-0000-0001"), "138****0001");
  assert.equal(maskNumber("138-0000-0002"), "138****0002");
});

test("掩码：短号（≤6 位）原样返回", () => {
  assert.equal(maskNumber("1234"), "1234");
});

test("拨入方向：a 打给 b 用 bNumber，反向用 aNumber", () => {
  const { session } = allocatePair([], DEMO_POOL, "w1", "a", "b", 1000);
  assert.equal(dialInNumber(session, "a"), session.bNumber);
  assert.equal(dialInNumber(session, "b"), session.aNumber);
});

test("48h 会话：过期后 findSession live=false，销毁后不可见", () => {
  const { sessions, session } = allocatePair([], DEMO_POOL, "w1", "a", "b", 1000);
  const liveSoon = findSession(sessions, "w1", "a", 1000 + 3600_000);
  assert.equal(liveSoon?.live, true);
  const after = findSession(sessions, "w1", "a", session.expiresAt + 1);
  assert.equal(after?.live, false);
  const revoked = revokeSession(sessions, "w1", 2000);
  assert.equal(findSession(revoked, "w1", "a", 3000), null);
  assert.equal(minutesLeft(session, session.expiresAt + 1), 0);
});

test("IM：建线程幂等，发消息未读+1，已读清零", () => {
  let threads: Awaited<ReturnType<typeof ensureThread>>["threads"] = [];
  let msgs: ReturnType<typeof sendMsg>["messages"] = [];
  const t1 = ensureThread(threads, "u1", "u2", 1000);
  threads = t1.threads;
  assert.equal(keyOf("u2", "u1"), "u1|u2");

  const s1 = sendMsg(threads, msgs, "u1", "u2", "在吗", 1000);
  threads = s1.threads;
  msgs = s1.messages;
  assert.equal(unreadTotal(threads, "u2"), 1);
  assert.equal(unreadTotal(threads, "u1"), 0);

  const s2 = sendMsg(threads, msgs, "u2", "u1", "在", 2000);
  threads = s2.threads;
  msgs = s2.messages;
  assert.equal(unreadTotal(threads, "u1"), 1);

  threads = markRead(threads, "u1|u2", "u1");
  assert.equal(unreadTotal(threads, "u1"), 0);
  assert.equal(threadMessages(msgs, "u1|u2").length, 2);
  assert.equal(threadMessages(msgs, "nope").length, 0);
});