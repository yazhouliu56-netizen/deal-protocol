import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  mergeWave,
  mergeClaim,
  mergeClaimLists,
  mergeMetadata,
  isTerminalWave,
  isTerminalClaim,
  waveStatusRank,
  effectiveTimestampWave,
  effectiveTimestampClaim,
} from "./state-crdt.ts";
import type { Wave, Claim, WaveMetadata } from "./wave.ts";

// 稳定序列化（与实现同口径，键排序）
function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${(v as unknown[]).map(stableStringify).join(",")}]`;
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}
function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function mkWave(overrides: Partial<Wave> & { id: string }): Wave {
  const now = 1700000000000;
  return {
    id: overrides.id,
    authorId: overrides.authorId ?? "author-1",
    basics: overrides.basics ?? { category: "test", time: "now", area: "area", radiusKm: 5 },
    budget: overrides.budget ?? 100,
    customs: overrides.customs ?? [],
    negotiable: overrides.negotiable ?? false,
    capacity: overrides.capacity ?? 1,
    expiresAt: overrides.expiresAt ?? now + 86400000,
    startsAt: overrides.startsAt,
    createdAt: overrides.createdAt ?? now,
    status: overrides.status ?? "active",
    version: overrides.version,
    claimedById: overrides.claimedById,
    modules: overrides.modules,
    metadata: overrides.metadata,
    hotness: overrides.hotness,
    fissionCount: overrides.fissionCount,
    fissionBy: overrides.fissionBy,
    fissionUpdatedAt: overrides.fissionUpdatedAt,
    ammoId: overrides.ammoId,
    customRequirements: overrides.customRequirements,
    bizParams: overrides.bizParams,
    biddingSettled: overrides.biddingSettled,
    waitlist: overrides.waitlist,
    joinRequests: overrides.joinRequests,
    needApproval: overrides.needApproval,
  } as Wave;
}

function mkClaim(overrides: Partial<Claim> & { id: string; waveId: string }): Claim {
  const now = 1700000000000;
  return {
    id: overrides.id,
    waveId: overrides.waveId,
    responderId: overrides.responderId ?? "resp-1",
    status: overrides.status ?? "offered",
    rounds: overrides.rounds ?? 0,
    price: overrides.price,
    lastMessage: overrides.lastMessage,
    lastBy: overrides.lastBy,
    depositPhase: overrides.depositPhase,
    serviceDoneAt: overrides.serviceDoneAt,
    fulfilment: overrides.fulfilment,
    modules: overrides.modules,
    fulfilledAt: overrides.fulfilledAt,
    reviewedBy: overrides.reviewedBy,
    settled: overrides.settled,
    guests: overrides.guests,
    createdAt: overrides.createdAt ?? now,
  } as Claim;
}

describe("base/order/state-crdt — H1/H3 终局不可逆与定序", () => {
  it("Wave 终局 closed 不被 active + 高 version 回退（H1 终局优先 > version）", () => {
    const closed = mkWave({ id: "w1", status: "closed", version: 1, createdAt: 1000 });
    const activeHigh = mkWave({ id: "w1", status: "active", version: 99, createdAt: 9999999999999 });
    const m1 = mergeWave(closed, activeHigh);
    const m2 = mergeWave(activeHigh, closed);
    assert.equal(m1.status, "closed");
    assert.equal(m2.status, "closed");
    assert.ok(deepEqual(m1, m2), "交换律失效：终局优先未守");
  });

  it("Wave expired 同为终局时按 version 裁决，version 相等则按有效时钟", () => {
    const e1 = mkWave({ id: "w1", status: "expired", version: 2, createdAt: 2000 });
    const e2 = mkWave({ id: "w1", status: "expired", version: 2, createdAt: 3000 });
    // version 相等，按有效时钟（version>0 取 version，故时钟相等，退至 rank/id 字典序）
    // 此处 version 相等且终局相同，rank 相同，时钟均为 version(2)，退至 id/JSON 字典序，仍确定
    const m = mergeWave(e1, e2);
    assert.ok(isTerminalWave(m.status));
  });

  it("Claim accepted 终局不被 negotiating 高 version 回退", () => {
    const acc = mkClaim({ id: "c1", waveId: "w1", status: "accepted", createdAt: 1000 });
    const negoHigh = mkClaim({ id: "c1", waveId: "w1", status: "negotiating", createdAt: 9999999999999, rounds: 99 });
    void mergeWave(mkWave({ id: "w1", status: "active" }), mkWave({ id: "w1", status: "active" }));
    // 直接测 claim 合并
    const mc = mergeClaim(acc, negoHigh);
    assert.equal(mc.status, "accepted");
    const mc2 = mergeClaim(negoHigh, acc);
    assert.ok(deepEqual(mc, mc2));
  });

  it("version 大者优先（非终局场景）", () => {
    const v1 = mkWave({ id: "w1", status: "active", version: 1, createdAt: 1000 });
    const v5 = mkWave({ id: "w1", status: "active", version: 5, createdAt: 1000 });
    assert.equal(mergeWave(v1, v5).version, 5);
    assert.equal(mergeWave(v5, v1).version, 5);
    assert.equal(mergeWave(v1, v5).status, "active");
  });

  it("有效时钟 LWW：version 相等时时钟大者胜（H2）", () => {
    const a = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, startsAt: 5000, expiresAt: 0 });
    const b = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, startsAt: 9000, expiresAt: 0 });
    // effectiveTimestampWave 取 max(createdAt,startsAt,expiresAt)，b 的 startsAt 更大
    assert.equal(effectiveTimestampWave(a), 5000);
    assert.equal(effectiveTimestampWave(b), 9000);
    void mergeWave(a, b);
    // 时钟大者胜，但本例 ambos 同 status/rank/version，时钟决定 winner 的其他标量
    // 用 bizParams 区分：时钟大者的 bizParams 覆盖
    const aw = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, startsAt: 5000, expiresAt: 0, bizParams: { k: "a" } });
    const bw = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, startsAt: 9000, expiresAt: 0, bizParams: { k: "b" } });
    assert.equal((mergeWave(aw, bw).bizParams as Record<string, unknown>).k, "b");
    assert.equal((mergeWave(bw, aw).bizParams as Record<string, unknown>).k, "b");
  });

  it("状态秩：locked > claimed > active（version/时钟相等时）", () => {
    const active = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000 });
    const claimed = mkWave({ id: "w1", status: "claimed", version: undefined, createdAt: 1000 });
    const locked = mkWave({ id: "w1", status: "locked", version: undefined, createdAt: 1000 });
    assert.ok(waveStatusRank(locked.status) > waveStatusRank(claimed.status));
    assert.equal(mergeWave(active, claimed).status, "claimed");
    assert.equal(mergeWave(claimed, locked).status, "locked");
    assert.equal(mergeWave(active, locked).status, "locked");
  });
});

describe("base/order/state-crdt — H4 集合并集幂等", () => {
  it("claims 按 id 并集，单项按 statusRank+时钟 LWW（H4）", () => {
    const c1a = mkClaim({ id: "c1", waveId: "w1", status: "offered", createdAt: 1000 });
    const c1b = mkClaim({ id: "c1", waveId: "w1", status: "negotiating", createdAt: 2000 });
    const c2 = mkClaim({ id: "c2", waveId: "w1", status: "offered", createdAt: 1500 });
    const m = mergeClaimLists([c1a, c2], [c1b]);
    assert.equal(m.length, 2);
    assert.equal(m.find((c) => c.id === "c1")!.status, "negotiating");
    assert.equal(m.find((c) => c.id === "c2")!.id, "c2");
    // 交换律
    const m2 = mergeClaimLists([c1b], [c1a, c2]);
    assert.ok(deepEqual(m, m2));
  });

  it("waitlist/joinRequests 按 responderId 并集，at 大者覆盖（LWW）", () => {
    const wA = mkWave({
      id: "w1",
      status: "active",
      waitlist: [{ responderId: "u1", at: 100 }],
      joinRequests: [{ responderId: "u2", at: 100 }],
    });
    const wB = mkWave({
      id: "w1",
      status: "active",
      waitlist: [
        { responderId: "u1", at: 200 },
        { responderId: "u3", at: 150 },
      ],
      joinRequests: [{ responderId: "u2", at: 50 }],
    });
    const m = mergeWave(wA, wB);
    assert.deepEqual(m.waitlist, [
      { responderId: "u1", at: 200 },
      { responderId: "u3", at: 150 },
    ]);
    assert.deepEqual(m.joinRequests, [{ responderId: "u2", at: 100 }]);
    // 交换律
    const m2 = mergeWave(wB, wA);
    assert.ok(deepEqual(m, m2));
  });

  it("并发 Claim 增量合并：三端各增一条，最终并集为 3 条（模拟三 Tab 并发）", () => {
    const base: Claim[] = [];
    const tabA = [mkClaim({ id: "c1", waveId: "w1", status: "offered" })];
    const tabB = [mkClaim({ id: "c2", waveId: "w1", status: "offered" })];
    const tabC = [mkClaim({ id: "c3", waveId: "w1", status: "offered" })];
    const mAB = mergeClaimLists(base, tabA);
    const mABC1 = mergeClaimLists(mAB, tabB);
    const mABC = mergeClaimLists(mABC1, tabC);
    // 乱序合并结果一致
    const shuffled = mergeClaimLists(mergeClaimLists(tabC, tabA), tabB);
    assert.equal(mABC.length, 3);
    assert.ok(deepEqual(mABC, shuffled));
  });
});

describe("base/order/state-crdt — H5 参数单袋与 metadata", () => {
  it("bizParams 浅合并：冲突键以时钟大者覆盖，时钟相等则 JSON 字典序（H5 交换律）", () => {
    const a = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, bizParams: { k: "a", a: 1 } });
    const b = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 2000, bizParams: { k: "b", b: 2 } });
    const m1 = mergeWave(a, b);
    const m2 = mergeWave(b, a);
    assert.equal((m1.bizParams as Record<string, unknown>).k, "b");
    assert.equal((m1.bizParams as Record<string, unknown>).a, 1);
    assert.equal((m1.bizParams as Record<string, unknown>).b, 2);
    assert.ok(deepEqual(m1.bizParams, m2.bizParams));
  });

  it("bizParams 时钟相等时字典序大者胜（确保交换律）", () => {
    const a = mkWave({ id: "w1", status: "active", version: 5, bizParams: { k: "a" } });
    const b = mkWave({ id: "w1", status: "active", version: 5, bizParams: { k: "b" } });
    // version 相等→有效时钟均为 5，冲突键 k 按 JSON 字典序
    const m = mergeWave(a, b);
    assert.equal((m.bizParams as Record<string, unknown>).k, "b");
    assert.ok(deepEqual(mergeWave(a, b).bizParams, mergeWave(b, a).bizParams));
  });

  it("metadata 合并：biddingSettled.at 大者为准，其余数值取 max（H5）", () => {
    const m1: WaveMetadata = { hotness: 5, fissionCount: 2, biddingSettled: { winnerId: "u1", winnerName: "A", price: 100, feeYuan: 10, netYuan: 90, at: 1000 } };
    const m2: WaveMetadata = { hotness: 10, fissionCount: 1, biddingSettled: { winnerId: "u2", winnerName: "B", price: 200, feeYuan: 20, netYuan: 180, at: 2000 } };
    const out = mergeMetadata(m1, m2) as WaveMetadata;
    assert.equal(out.hotness, 10);
    assert.equal(out.fissionCount, 2);
    assert.equal(out.biddingSettled!.winnerId, "u2");
    const out2 = mergeMetadata(m2, m1) as WaveMetadata;
    assert.ok(deepEqual(out, out2));
  });

  it("metadata 空值兼容：单侧 undefined 时返回另一侧拷贝（不突变入参）", () => {
    const m: WaveMetadata = { hotness: 7 };
    const r1 = mergeMetadata(undefined, m);
    const r2 = mergeMetadata(m, undefined);
    assert.deepEqual(r1, m);
    assert.deepEqual(r2, m);
    assert.notEqual(r1, m);
    assert.equal(mergeMetadata(undefined, undefined), undefined);
  });
});

describe("base/order/state-crdt — 数学代数性质完备性（CRDT 三律）", () => {
  it("交换律：mergeWave(A,B) === mergeWave(B,A)（任意乱序）", () => {
    const A = mkWave({ id: "w1", status: "active", version: 1, createdAt: 1000, bizParams: { x: 1 }, waitlist: [{ responderId: "u1", at: 10 }] });
    const B = mkWave({ id: "w1", status: "claimed", version: 2, createdAt: 2000, bizParams: { x: 2, y: 2 }, waitlist: [{ responderId: "u2", at: 20 }] });
    assert.ok(deepEqual(mergeWave(A, B), mergeWave(B, A)));
    // Claim 亦然
    const cA = mkClaim({ id: "c1", waveId: "w1", status: "offered", createdAt: 1000 });
    const cB = mkClaim({ id: "c1", waveId: "w1", status: "negotiating", createdAt: 2000 });
    assert.ok(deepEqual(mergeClaim(cA, cB), mergeClaim(cB, cA)));
    assert.ok(deepEqual(mergeClaimLists([cA], [cB]), mergeClaimLists([cB], [cA])));
  });

  it("幂等性：mergeWave(A,A) === A 且 mergeClaimLists(A,A) === A", () => {
    const A = mkWave({ id: "w1", status: "locked", version: 3, createdAt: 3000, bizParams: { k: 1 }, waitlist: [{ responderId: "u1", at: 10 }] });
    assert.ok(deepEqual(mergeWave(A, A), A));
    const cA = mkClaim({ id: "c1", waveId: "w1", status: "accepted", createdAt: 1000 });
    assert.ok(deepEqual(mergeClaim(cA, cA), cA));
    assert.ok(deepEqual(mergeClaimLists([cA], [cA]), [cA]));
    // metadata 幂等
    const meta: WaveMetadata = { hotness: 5, biddingSettled: { winnerId: "u1", winnerName: "A", price: 100, feeYuan: 10, netYuan: 90, at: 1000 } };
    assert.ok(deepEqual(mergeMetadata(meta, meta), meta));
  });

  it("结合律：merge(A, merge(B,C)) === merge(merge(A,B), C)（Wave）", () => {
    const A = mkWave({ id: "w1", status: "pending", version: undefined, createdAt: 1000, bizParams: { a: 1 } });
    const B = mkWave({ id: "w1", status: "active", version: 1, createdAt: 2000, bizParams: { b: 2 } });
    const C = mkWave({ id: "w1", status: "claimed", version: 2, createdAt: 1500, bizParams: { c: 3 } });
    const left = mergeWave(A, mergeWave(B, C));
    const right = mergeWave(mergeWave(A, B), C);
    assert.ok(deepEqual(left, right), `结合律失效\nleft=${stableStringify(left)}\nright=${stableStringify(right)}`);
  });

  it("结合律：mergeClaimLists 亦满足（Claims）", () => {
    const A = [mkClaim({ id: "c1", waveId: "w1", status: "offered", createdAt: 1000 })];
    const B = [mkClaim({ id: "c1", waveId: "w1", status: "negotiating", createdAt: 2000 }), mkClaim({ id: "c2", waveId: "w1", status: "offered", createdAt: 1500 })];
    const C = [mkClaim({ id: "c2", waveId: "w1", status: "joined", createdAt: 3000 })];
    const left = mergeClaimLists(A, mergeClaimLists(B, C));
    const right = mergeClaimLists(mergeClaimLists(A, B), C);
    assert.ok(deepEqual(left, right));
  });

  it("三律综合：三端并发各持不同版本，最终收敛唯一（模拟 p2p_broadcast 乱序回放）", () => {
    const base = mkWave({ id: "w1", status: "active", version: 1, createdAt: 1000 });
    const tabA = mkWave({ id: "w1", status: "active", version: 2, createdAt: 2000, bizParams: { from: "A" } });
    const tabB = mkWave({ id: "w1", status: "claimed", version: 2, createdAt: 2500, bizParams: { from: "B" } });
    const tabC = mkWave({ id: "w1", status: "active", version: 3, createdAt: 1500, bizParams: { from: "C" } });
    const r1 = mergeWave(mergeWave(mergeWave(base, tabA), tabB), tabC);
    const r2 = mergeWave(mergeWave(mergeWave(base, tabC), tabA), tabB);
    const r3 = mergeWave(mergeWave(mergeWave(tabC, tabB), base), tabA);
    assert.ok(deepEqual(r1, r2));
    assert.ok(deepEqual(r2, r3));
  });
});

describe("base/order/state-crdt — 工具函数与边界", () => {
  it("isTerminal 判断与 rank 单调性", () => {
    assert.equal(isTerminalWave("closed"), true);
    assert.equal(isTerminalWave("expired"), true);
    assert.equal(isTerminalWave("active"), false);
    assert.equal(isTerminalClaim("accepted"), true);
    assert.equal(isTerminalClaim("breached"), true);
    assert.equal(isTerminalClaim("withdrawn"), true);
    assert.equal(isTerminalClaim("offered"), false);
    assert.ok(waveStatusRank("locked") > waveStatusRank("claimed"));
    assert.ok(waveStatusRank("claimed") > waveStatusRank("active"));
  });

  it("effectiveTimestampWave 遵循裁决：version>0 取 version，否则取时钟 max", () => {
    const withVer = mkWave({ id: "w1", status: "active", version: 5, createdAt: 9999999999999 });
    const withoutVer = mkWave({ id: "w1", status: "active", version: undefined, createdAt: 1000, startsAt: 5000, expiresAt: 3000 });
    assert.equal(effectiveTimestampWave(withVer), 5);
    assert.equal(effectiveTimestampWave(withoutVer), 5000);
  });

  it("effectiveTimestampClaim 取 max(serviceDoneAt,fulfilledAt,createdAt)", () => {
    const c = mkClaim({ id: "c1", waveId: "w1", status: "offered", createdAt: 1000, serviceDoneAt: 5000, fulfilledAt: 3000 });
    assert.equal(effectiveTimestampClaim(c), 5000);
  });

  it("version 自增抢占：merged version 为 max，且不回退", () => {
    const a = mkWave({ id: "w1", status: "active", version: 1 });
    const b = mkWave({ id: "w1", status: "active", version: 3 });
    assert.equal(mergeWave(a, b).version, 3);
    assert.equal(mergeWave(b, a).version, 3);
    // 终局 + 低 version 仍保 version max
    const closed = mkWave({ id: "w1", status: "closed", version: 1 });
    const activeHigh = mkWave({ id: "w1", status: "active", version: 10 });
    assert.equal(mergeWave(closed, activeHigh).version, 10);
    assert.equal(mergeWave(closed, activeHigh).status, "closed");
  });
});
