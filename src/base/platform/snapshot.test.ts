import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SNAPSHOT_PREFIX,
  applySnapshot,
  collectSnapshot,
  packSnapshot,
  parseSnapshot,
  validateSnapshot,
  type LikeStorage,
} from "./snapshot.ts";

/** 内存 fake storage（模拟 localStorage 的 oto-* 键与无关键混存）。 */
function fakeStorage(init: Record<string, string> = {}): LikeStorage {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}

test("collectSnapshot: picks only oto-* keys, keeps raw strings", () => {
  const st = fakeStorage({
    "oto-broadcast-v1": '{"waves":[]}',
    "oto-organizer-sub": '{"sub":{}}',
    "ai-spatial-storage": '{"other-app":true}',
    "unrelated": "x",
  });
  const snap = collectSnapshot(st, 1234);
  assert.equal(snap.app, "oto-spatial");
  assert.equal(snap.version, 1);
  assert.equal(snap.exportedAt, 1234);
  assert.deepEqual(snap.keys, ["oto-broadcast-v1", "oto-organizer-sub"]);
  assert.equal(snap.stores["oto-broadcast-v1"], '{"waves":[]}');
  assert.equal("ai-spatial-storage" in snap.stores, false);
});

test("validateSnapshot: rejects wrong app / too-new version / bad shapes", () => {
  const good = collectSnapshot(fakeStorage({ "oto-x": "1" }), 1);
  assert.equal(validateSnapshot(good), true);
  assert.equal(validateSnapshot({ ...good, app: "other" }), false);
  assert.equal(validateSnapshot({ ...good, version: 99 }), false);
  assert.equal(validateSnapshot({ ...good, stores: null }), false);
  assert.equal(validateSnapshot({ ...good, keys: [1] }), false);
  assert.equal(validateSnapshot({ ...good, stores: { k: 42 } }), false);
  assert.equal(validateSnapshot(null), false);
  assert.equal(validateSnapshot("garbage"), false);
});

test("pack/parse round-trips a snapshot", () => {
  const st = fakeStorage({ "oto-roam-v1": '{"lvl":3}' });
  const snap = collectSnapshot(st, 9);
  const parsed = parseSnapshot(packSnapshot(snap));
  assert.ok(parsed);
  assert.deepEqual(parsed, snap);
  assert.equal(parseSnapshot("{oops"), null);
});

test("applySnapshot: writes only oto-* keys back, counts skips", () => {
  const st = fakeStorage({ old: "keep" });
  const out = applySnapshot(
    st,
    packSnapshot({
      app: "oto-spatial",
      version: 1,
      exportedAt: 5,
      keys: ["oto-a", "oto-b", "evil-x"],
      stores: {
        "oto-a": '{"a":1}',
        "oto-b": '{"b":2}',
        "evil-x": "must-not-write",
      },
    })
  );
  assert.deepEqual(out.applied, ["oto-a", "oto-b"]);
  assert.equal(out.skipped, 1);
  assert.equal(st.getItem("oto-a"), '{"a":1}');
  assert.equal(st.getItem("oto-b"), '{"b":2}');
  assert.equal(st.getItem("evil-x"), null);
  // unrelated untouched
  assert.equal(st.getItem("old"), "keep");
});

test("applySnapshot: invalid input is rejected with an error, writes nothing", () => {
  const st = fakeStorage({});
  const r1 = applySnapshot(st, "not-json");
  assert.equal(r1.applied.length, 0);
  assert.ok(r1.error);
  const r2 = applySnapshot(st, { app: "other", stores: {} });
  assert.equal(r2.applied.length, 0);
  assert.ok(r2.error);
});

test("applySnapshot: older-version snapshots still apply (forward-compat)", () => {
  const st = fakeStorage({});
  const out = applySnapshot(
    st,
    packSnapshot({
      app: "oto-spatial",
      version: 0,
      exportedAt: 1,
      keys: ["oto-x"],
      stores: { "oto-x": "v" },
    })
  );
  assert.deepEqual(out.applied, ["oto-x"]);
  assert.equal(SNAPSHOT_PREFIX, "oto-");
});
