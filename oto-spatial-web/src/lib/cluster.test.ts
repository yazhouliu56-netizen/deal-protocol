import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPushes,
  enrichWaveTags,
  mockClusterTags,
  pushReason,
} from "./cluster.ts";
import { broadcastMatches } from "./broadcast.ts";
import type { ResponderCapability } from "./broadcast.ts";
import type { Wave } from "./wave.ts";

const cook: ResponderCapability = {
  id: "r-cook",
  nickname: "厨娘",
  categories: ["厨师 · 上门做饭"],
  tags: ["30岁", "生日"],
  distanceKm: 2,
  creditLevel: 4,
  verified: true,
  online: true,
};
const farCook: ResponderCapability = {
  id: "r-far",
  nickname: "远厨",
  categories: ["厨师 · 上门做饭"],
  tags: [],
  distanceKm: 12,
  creditLevel: 3,
  online: true,
};
const player: ResponderCapability = {
  id: "r-ball",
  nickname: "球友",
  categories: ["羽毛球约局"],
  tags: ["进阶"],
  online: true,
};

const wave = (over: Partial<Wave> = {}): Wave =>
  ({
    id: "w1",
    authorId: "demander-1",
    basics: {
      category: "厨师 · 上门做饭",
      time: "明天 11:00",
      area: "附近",
      radiusKm: 5,
    },
    budget: 100,
    customs: [{ text: "30 岁左右女性", tags: ["30岁"] }],
    negotiable: true,
    negotiableNote: "上门服务，别迟到",
    capacity: 1,
    expiresAt: Date.now() + 3600_000,
    createdAt: Date.now(),
    status: "active",
    ...over,
  }) as Wave;

const flat = (w: Wave) => ({
  category: w.basics.category,
  customs: w.customs,
  negotiableNote: w.negotiableNote,
});

test("mockClusterTags extracts category + custom + note semantics", () => {
  const tags = mockClusterTags(flat(wave()));
  assert.ok(tags.includes("上门做饭"));
  assert.ok(tags.includes("30岁"));
  assert.ok(tags.includes("上门服务"), "note 关键词命中");
});

test("enrichWaveTags merges LLM tags into custom tags (dedup)", () => {
  const out = enrichWaveTags(wave(), ["生日", "30岁"]);
  const tags = out.customs?.[0].tags ?? [];
  assert.deepEqual(new Set(tags), new Set(["30岁", "生日"]));
});

test("buildPushes hard-filters + ranks, excludes the author", () => {
  const pushes = buildPushes(wave(), [cook, farCook, player], ["生日"], broadcastMatches);
  const ids = pushes.map((p) => p.toId);
  assert.ok(ids.includes("r-cook"));
  assert.ok(!ids.includes("r-far"), "12km 超附近半径被硬筛");
  assert.ok(!ids.includes("r-ball"), "品类不匹配被硬筛");
  assert.equal(pushes[0].toId, "r-cook", "近距 + 标签命中 + 高信用排最前");
  assert.ok(pushes[0].customHits >= 1);
});

test("buildPushes never pushes to the wave author", () => {
  const w = wave({ authorId: "r-cook" });
  assert.equal(buildPushes(w, [cook, player], [], broadcastMatches).length, 0);
});

test("pushReason reads like a human line", () => {
  const hit = broadcastMatches([cook], enrichWaveTags(wave(), ["生日"]))[0];
  assert.ok(pushReason(hit, "生日").includes("命中标签「生日」×2"));
  assert.ok(pushReason(hit, "生日").includes("距离 2 公里内"));
  assert.ok(pushReason(hit, "生日").includes("信用 Lv.4"));
});

test("buildPushes tags the actually-hit semantic tag", () => {
  const p = buildPushes(wave(), [cook], ["上门做饭", "生日"], broadcastMatches)[0];
  assert.equal(p.tag, "生日", "优先命中响应者自己的标签");
  assert.ok(p.reason.includes("「生日」"));
});