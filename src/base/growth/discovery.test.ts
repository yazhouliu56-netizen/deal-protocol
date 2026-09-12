/**
 * 发现推荐考卷（B4 · node:test）。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  behaviorCountOf,
  EMPTY_PROFILE,
  orderPills,
  priorWeight,
  suggestByPrefix,
  type DiscoveryProfile,
} from "./discovery.ts";

const PILLS = [
  { ammoId: "meetup-social-v1", category: "meetup" },
  { ammoId: "housekeeping-v1", category: "housekeeping" },
  { ammoId: "companion-v1", category: "companion" },
  { ammoId: "appliance-repair-v1", category: "appliance" },
];
const FEATURED = ["meetup-social-v1", "housekeeping-v1", "companion-v1", "appliance-repair-v1"];

test("先验衰减：0 行为权重 1，3 行为归零（N=3 已拍）", () => {
  assert.equal(priorWeight(0), 1);
  assert.equal(priorWeight(1.5), 0.5);
  assert.equal(priorWeight(3), 0);
  assert.equal(priorWeight(99), 0);
});

test("新用户：图纸教育序（行为<3，即使有点过）", () => {
  const p: DiscoveryProfile = { ...EMPTY_PROFILE, pillClicks: { companion: 2 } };
  assert.deepEqual(
    orderPills(PILLS, p, FEATURED).map((x) => x.ammoId),
    FEATURED,
  );
});

test("老用户：复购优先（订单×2＋点击），零分保原序", () => {
  const p: DiscoveryProfile = {
    orderCounts: { companion: 2 },
    pillClicks: { appliance: 5 },
    optOut: false,
  };
  const ordered = orderPills(PILLS, p, FEATURED).map((x) => x.ammoId);
  assert.equal(ordered[0], "appliance-repair-v1");
  assert.equal(ordered[1], "companion-v1");
});

test("optOut：永远图纸原序（行为再多也不动）", () => {
  const p: DiscoveryProfile = {
    orderCounts: { companion: 99 },
    pillClicks: {},
    optOut: true,
  };
  assert.deepEqual(
    orderPills(PILLS, p, FEATURED).map((x) => x.ammoId),
    PILLS.map((x) => x.ammoId),
  );
});

test("联想：前缀优先＋包含兜底＋去重＋空输入[]", () => {
  const entries = [
    { alias: "换灯泡", category: "housekeeping", label: "家政保洁" },
    { alias: "灯泡维修", category: "appliance", label: "家电维修" },
    { alias: "客厅灯泡更换", category: "housekeeping", label: "家政保洁" },
    { alias: "组局打球", category: "meetup", label: "组局" },
  ];
  const r = suggestByPrefix("灯泡", entries);
  assert.equal(r[0].alias, "灯泡维修");
  assert.equal(r.filter((e) => e.category === "housekeeping").length, 1);
  assert.deepEqual(suggestByPrefix("  ", entries), []);
  assert.deepEqual(suggestByPrefix("组", entries).map((e) => e.category), ["meetup"]);
});

test("behaviorCountOf：订单全权＋点击半权", () => {
  assert.equal(
    behaviorCountOf({ orderCounts: { a: 2 }, pillClicks: { b: 2 }, optOut: false }),
    3,
  );
});
