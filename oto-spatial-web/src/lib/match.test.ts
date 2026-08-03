import { test } from "node:test";
import assert from "node:assert/strict";
import {
  areaDistanceKm,
  badgeOf,
  budgetNumber,
  matchProviders,
  scoreProvider,
  type MatchNeed,
} from "./match.ts";
import type { ProviderItem } from "./chat/types.ts";

const kai: ProviderItem = {
  id: "p2",
  name: "阿凯",
  emoji: "😎",
  meta: "业余进阶",
  rating: 4.9,
  price: "¥25/局",
  basePrice: 25,
  level: "advanced",
  distanceKm: 2.4,
  freeSlots: ["t2", "t4"],
};

const venue: ProviderItem = {
  id: "p1",
  name: "星羽羽毛球馆",
  emoji: "🏸",
  meta: "2 片场地",
  rating: 4.8,
  price: "场地 ¥80/小时",
  basePrice: 80,
  kind: "venue",
  distanceKm: 1.2,
};

const bear: ProviderItem = {
  id: "p4",
  name: "大熊",
  emoji: "🐻",
  meta: "新手友好",
  rating: 4.7,
  price: "¥15/局",
  basePrice: 15,
  level: "newbie",
  distanceKm: 4.0,
  freeSlots: ["t3"],
};

const all: ProviderItem[] = [kai, venue, bear];

const need = (patch: MatchNeed = {}): MatchNeed => ({
  level: "进阶",
  budget: "单次 30 元以内",
  area: "附近",
  slotId: "t2",
  ...patch,
});

test("budgetNumber extracts first number", () => {
  assert.equal(budgetNumber("单次 50 元以内"), 50);
  assert.equal(budgetNumber(null), null);
  assert.equal(budgetNumber(undefined), null);
});

test("areaDistanceKm resolves area strings", () => {
  assert.equal(areaDistanceKm("附近 5 公里"), 5);
  assert.equal(areaDistanceKm("就近"), 3);
  assert.equal(areaDistanceKm("滨江"), 5);
  assert.equal(areaDistanceKm("三里屯"), 4);
  assert.equal(areaDistanceKm("市中心"), 2);
  assert.equal(areaDistanceKm("随便说说"), null);
  assert.equal(areaDistanceKm(null), null);
});

test("scoreProvider: large party boosts venues", () => {
  const need5 = need({ partySize: 5, budget: "单次 200 元以内" });
  const { score, breakdown } = scoreProvider(venue, need5);
  assert.equal(score, 83); // 25+10+12+14+10+10+2
  assert.equal(breakdown.availability, 10);
  const { score: solo } = scoreProvider(
    venue,
    need({ partySize: 2, budget: "单次 200 元以内" })
  );
  assert.equal(solo, 81);
  const { score: person } = scoreProvider(
    kai,
    need({ partySize: 6, budget: "单次 200 元以内" })
  );
  assert.equal(person, 88); // 25+4+12+15+6+10+0（非场馆无加成）
});

test("badgeOf thresholds", () => {
  assert.equal(badgeOf(90), "极高匹配");
  assert.equal(badgeOf(80), "极高匹配");
  assert.equal(badgeOf(79), "高匹配");
  assert.equal(badgeOf(65), "高匹配");
  assert.equal(badgeOf(50), "中等");
  assert.equal(badgeOf(30), "待考虑");
});

test("scoreProvider: perfect level + budget + availability", () => {
  const { score, breakdown } = scoreProvider(kai, need());
  assert.equal(breakdown.budget, 25); // 25 <= 30*1.15
  assert.equal(breakdown.level, 20); // advanced == 进阶
  assert.equal(breakdown.style, 12); // no style needed: neutral
  assert.equal(breakdown.rating, 15); // 4.9/5*15
  assert.equal(breakdown.distance, 6); // 2.4 <= 3 (就近)
  assert.equal(breakdown.availability, 10); // t2 in freeSlots
  assert.equal(score, 88);
});

test("scoreProvider: venue is level-agnostic", () => {
  const { breakdown } = scoreProvider(venue, need());
  assert.equal(breakdown.level, 10);
  assert.equal(breakdown.distance, 10); // 1.2 <= 1.5 (3*0.5)
  assert.equal(breakdown.availability, 10); // no freeSlots: assume free
});

test("scoreProvider: unavailable slot scores 0", () => {
  const { breakdown } = scoreProvider(bear, need({ slotId: "t2" }));
  assert.equal(breakdown.availability, 0);
  assert.equal(breakdown.level, 4); // newbie vs 进阶: dist 2
  assert.equal(breakdown.distance, 2); // 4.0 > 3
});

test("scoreProvider: neutral scores when no dimensions given", () => {
  const { score, breakdown } = scoreProvider(bear, {});
  assert.equal(breakdown.budget, 15);
  assert.equal(breakdown.level, 16); // has level, user unknown → full-ish
  assert.equal(breakdown.style, 12);
  assert.equal(breakdown.distance, 5);
  assert.equal(breakdown.availability, 10);
  assert.equal(score, 72); // 15+16+12+14+5+10
});

test("scoreProvider: budget too high degrades to half", () => {
  const { breakdown } = scoreProvider(kai, need({ budget: "单次 20 元以内" }));
  assert.equal(breakdown.budget, 12); // 25 <= 23 → not full; <= 30 → half
});

test("matchProviders: idle slot ranks the available newbie first", () => {
  const ranked = matchProviders(all, need({ level: "新手", slotId: "t3" }));
  assert.equal(ranked[0].id, "p4"); // 大熊 可约 t3 + 同水平
  assert.equal(ranked[0].match.score, 83);
  assert.equal(ranked[0].availability, "可约");
});

test("matchProviders: hot slot + high budget ranks venue first, unavailable marked", () => {
  const ranked = matchProviders(
    all,
    need({ level: "新手", slotId: "t2", budget: "单次 200 元以内" })
  );
  assert.equal(ranked[0].id, "p1"); // 星羽 高预算解锁 + 距离近 + 全可约
  assert.equal(ranked[0].availability, "全时段可约");
  const bearRank = ranked.findIndex((p) => p.id === "p4");
  assert.equal(ranked[bearRank].availability, "本时段不可约");
});

test("matchProviders: tight budget keeps venue out (price filter)", () => {
  const ranked = matchProviders(all, need({ level: "新手", slotId: "t2" }));
  assert.equal(ranked[0].id, "p4"); // 大熊 73 > 阿凯 72 > 星羽 56 (80 超预算)
  assert.equal(ranked[2].id, "p1");
  assert.equal(ranked[2].breakdown.budget, 0);
});

test("matchProviders: style match wins for photography", () => {
  const acha: ProviderItem = {
    id: "p1",
    name: "阿茶",
    emoji: "📷",
    meta: "日系",
    rating: 4.9,
    price: "¥499/套",
    basePrice: 499,
    styleTag: "日系",
    distanceKm: 2.6,
  };
  const momo: ProviderItem = {
    id: "p3",
    name: "Momo",
    emoji: "✨",
    meta: "街头",
    rating: 4.7,
    price: "¥399/套",
    basePrice: 399,
    styleTag: "街头",
    distanceKm: 1.8,
    freeSlots: ["t2", "t4"],
  };
  const ranked = matchProviders(
    [acha, momo],
    need({ style: "日系", budget: "单次 500 元以内", area: "附近 5 公里", slotId: "t1" })
  );
  assert.equal(ranked[0].id, "p1"); // 日系需求 → 阿茶
  assert.equal(ranked[0].match.score, 86); // 25+10+20+15+6+10
  const { breakdown } = scoreProvider(acha, {
    style: "日系",
    budget: "单次 500 元以内",
    area: "附近 5 公里",
    slotId: "t1",
  });
  assert.equal(breakdown.style, 20);
  assert.equal(breakdown.distance, 6); // 2.6 > 2.5 (5*0.5) → 6
  assert.equal(breakdown.distance, 6);
});
