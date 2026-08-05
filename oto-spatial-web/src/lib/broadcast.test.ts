import { test } from "node:test";
import assert from "node:assert/strict";
import {
  broadcastMatches,
  passesHardFilter,
  requiresVerification,
  type ResponderCapability,
  type WaveLike,
} from "./broadcast.ts";

const chef = (id: string, over: Partial<ResponderCapability> = {}): ResponderCapability => ({
  id,
  nickname: `${id}-nick`,
  categories: ["厨师 · 上门做饭"],
  tags: ["女性", "熟手"],
  distanceKm: 1,
  rating: 4.8,
  creditLevel: 4,
  verified: true,
  online: true,
  ...over,
});

const wave: WaveLike = {
  id: "w1",
  basics: {
    category: "厨师 · 上门做饭",
    time: "明天 11:00",
    area: "幸福家园小区",
    radiusKm: 5,
  },
  customs: [
    { text: "30 岁左右女性", tags: ["女性"] },
    { text: "穿 JK 装", tags: ["JK"] },
  ],
};

test("passesHardFilter gates on category / offline", () => {
  assert.equal(passesHardFilter(chef("a"), wave).ok, true);
  assert.equal(passesHardFilter(chef("b", { categories: ["羽毛球"] }), wave).ok, false);
  assert.equal(passesHardFilter(chef("c", { online: false }), wave).ok, false);
  assert.equal(passesHardFilter(chef("d", { banned: true }), wave).ok, false, "封禁响应者被硬筛");
  assert.equal(
    broadcastMatches([chef("d", { banned: true })], wave).length,
    0,
    "被封禁者不出现在广播"
  );

test("requiresVerification: home-access categories need verified responders", () => {
  assert.equal(requiresVerification("陪诊陪护"), true);
  assert.equal(requiresVerification("家政保洁"), true);
  assert.equal(requiresVerification("厨师 · 上门做饭"), true);
  assert.equal(requiresVerification("羽毛球约局"), false);
  // hard gate: unverified responder cannot take home-access waves
  const homeWave: WaveLike = {
    ...wave,
    basics: { ...wave.basics, category: "家政保洁" },
  };
  assert.equal(passesHardFilter(chef("u1", { verified: false }), homeWave).ok, false);
  assert.equal(
    passesHardFilter(chef("u1", { verified: false }), homeWave).why,
    "unverified"
  );
  assert.equal(
    passesHardFilter(chef("u2", { categories: ["家政保洁"] }), homeWave).ok,
    true
  );
  // 未认证对进家品类被硬筛（u3 是默认 verified:true → 需显式关掉）
  assert.equal(
    passesHardFilter(chef("u3", { verified: false }), wave).ok,
    false,
    "厨师单对未认证者拦截"
  );
  // non-home categories stay open to anyone
  const sportWave: WaveLike = {
    ...wave,
    basics: { ...wave.basics, category: "羽毛球约局" },
  };
  assert.equal(
    passesHardFilter(
      chef("u4", { verified: false, categories: ["羽毛球约局"] }),
      sportWave
    ).ok,
    true,
    "户外品类未认证可接"
  );
});

test("star growth bonus: ★≥4 + ≥90% completion pushes credit up", () => {
  const base = broadcastMatches([chef("a")], wave)[0];
  const boosted = broadcastMatches(
    [chef("a", { star: 5, completion: 0.95 })],
    wave
  )[0];
  assert.ok(boosted.score > base.score, "星级加成提升匹配分");
  assert.equal(boosted.score - base.score, 5, "新增 +5（credit 段）");
  // poor completion or low stars → no bonus
  const weak = broadcastMatches(
    [chef("a", { star: 5, completion: 0.8 })],
    wave
  )[0];
  assert.equal(weak.score, base.score);
});
});

test("distance beyond radius stays visible but ranks lower (软约束)", () => {
  assert.equal(passesHardFilter(chef("far", { distanceKm: 9 }), wave).ok, true);
  const hits = broadcastMatches(
    [chef("near", { distanceKm: 1 }), chef("far", { distanceKm: 9 })],
    wave
  );
  assert.equal(hits[0]!.id, "near", "近者排前");
  assert.ok(hits.some((h) => h.id === "far"), "远者仍可见");
});

test("responders covering more custom conditions rank higher (定制软加权)", () => {
  const full = chef("full", { tags: ["女性", "JK", "熟手"] });
  const partial = chef("partial", { tags: ["女性"] });
  const none = chef("none", { tags: ["小鲜肉"] });
  const hits = broadcastMatches([partial, full, none], wave);
  assert.equal(hits[0]!.id, "full");
  assert.equal(hits[0]!.customHits, 2);
  // even zero-overlap responders are NOT filtered out — just ranked last
  assert.ok(hits.some((h) => h.id === "none"));
});

test("no customs → neutral custom credit, sorted by distance/credit", () => {
  const w: WaveLike = { ...wave, customs: [] };
  const far = chef("farx", { distanceKm: 4, creditLevel: 3 });
  const near = chef("nearx", { distanceKm: 1, creditLevel: 5 });
  const hits = broadcastMatches([far, near], w);
  assert.equal(hits[0]!.id, "nearx");
});

test("offline-only pool returns empty", () => {
  const hits = broadcastMatches([chef("o", { online: false })], wave);
  assert.deepEqual(hits, []);
});