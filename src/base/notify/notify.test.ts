import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildNotifyItems,
  loadReadSet,
  persistReadSet,
  type NotifySource,
} from "./notify.ts";

function base(over: Partial<NotifySource> = {}): NotifySource {
  return {
    meId: "u-me",
    waves: [
      {
        id: "w-1",
        authorId: "u-me",
        basics: { category: "羽毛球约局" },
        status: "active",
      },
    ],
    claims: [],
    pushes: [],
    friendRequests: [],
    reportOutcomes: [],
    ...over,
  };
}

test("offered on my wave → one offer notify", () => {
  const src = base({
    claims: [
      {
        id: "c1",
        waveId: "w-1",
        status: "offered",
        responderId: "u-other",
        price: 45,
        createdAt: 1000,
      },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "offer");
  assert.equal(items[0].title, "羽毛球约局 来了新报价");
  assert.equal(items[0].key, "offer:w-1");
});

test("accepted overrides offered for same wave", () => {
  const src = base({
    claims: [
      {
        id: "c1",
        waveId: "w-1",
        status: "offered",
        responderId: "u-other",
        createdAt: 500,
      },
      {
        id: "c2",
        waveId: "w-1",
        status: "accepted",
        responderId: "u-other",
        createdAt: 2000,
      },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "accepted");
});

test("ignores claims not on my waves and my own offers", () => {
  const src = base({
    waves: [
      ...base().waves,
      { id: "w-2", authorId: "u-someone", basics: { category: "家政" }, status: "active" },
    ],
    claims: [
      {
        id: "c-x",
        waveId: "w-2",
        status: "offered",
        responderId: "u-me",
        createdAt: 300,
      },
      { id: "c-y", waveId: "w-2", status: "offered", responderId: "u-other", createdAt: 400 },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 0);
});

test("pushes only if addressed to me and unread", () => {
  const src = base({
    pushes: [
      { id: "p1", toId: "u-me", waveId: "w-1", at: 10, read: false },
      { id: "p2", toId: "u-me", waveId: "w-1", at: 20, read: true },
      { id: "p3", toId: "u-other", waveId: "w-1", at: 30, read: false },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, "push:p1");
});

test("friend requests addressed to me", () => {
  const src = base({
    friendRequests: [
      { id: "f1", toId: "u-me", fromId: "recruiter", at: 7 },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "friend");
});

test("waitlist-promoted push → 候补转正文案（含品类）", () => {
  const src = base({
    waves: [{ id: "w-1", authorId: "u-other", basics: { category: "羽毛球" }, status: "active" }],
    pushes: [
      { id: "waitlist-promoted:c9", toId: "u-me", waveId: "w-1", at: 99, read: false },
    ],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].key, "push:waitlist-promoted:c9");
  assert.ok(items[0].title.includes("羽毛球"));
  assert.ok(items[0].title.includes("候补转正"));
});

test("report outcomes included", () => {
  const src = base({
    reportOutcomes: [{ id: "r1", at: 5, verdict: "已驳回" }],
  });
  const items = buildNotifyItems(src);
  assert.equal(items.length, 1);
  assert.equal(items[0].kind, "report");
});

test("sorted desc by at", () => {
  const src = base({
    reportOutcomes: [{ id: "r1", at: 5, verdict: "x" }],
    friendRequests: [{ id: "f1", toId: "u-me", fromId: "a", at: 999 }],
    pushes: [{ id: "p1", toId: "u-me", waveId: "w-1", at: 42, read: false }],
  });
  const items = buildNotifyItems(src);
  assert.equal(items[0].key, "friend:f1");
  assert.equal(items[1].key, "push:p1");
  assert.equal(items[2].key, "report:r1");
});

test("read-set loads and persists round-trip", () => {
  const mem = new Map<string, string>();
  const fake = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
  } as unknown as Storage;
  assert.equal(loadReadSet(fake).size, 0);
  persistReadSet(["offer:w-1", "push:p9"], fake);
  const set = loadReadSet(fake);
  assert.equal(set.has("offer:w-1"), true);
  assert.equal(set.size, 2);
});