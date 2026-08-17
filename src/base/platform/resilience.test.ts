import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { compact, due, enqueue, markPlayed, type QueuedOp } from "./offlineQueue.ts";
import { allow, lever, trip, type Breaker } from "./circuit.ts";
import {
  abWinner,
  classifyApiPath,
  configureResiliencePersistence,
  degrades,
  evaluateDegradationGate,
  getGlobalDegradationLevel,
  lakeAppend,
  lakeVerify,
  pickVariant,
  setGlobalDegradationLevel,
  setGlobalDegradationLevelMemory,
  type DegradationLevel,
  type ResiliencePersistence,
  type SystemActionCategory,
} from "./resilience.ts";

test("离线队列：幂等入队 + 重放 + 指数退避", () => {
  let q: QueuedOp[] = [];
  const r1 = enqueue(q, { kind: "publish", payload: "羽毛球 100 元" }, 1000);
  q = r1.q;
  const r2 = enqueue(q, { kind: "publish", payload: "羽毛球 100 元" }, 2000);
  assert.equal(r2.fresh, false);
  assert.equal(due(q, 999).length, 0);
  assert.equal(due(q, 1000).length, 1);

  const item = due(q, 1000)[0];
  q = markPlayed(q, item.id, false, 1000); // 失败 → 退避 1000×2^1 = 2s → tryAt 3000
  assert.equal(q[0].attempts, 1);
  assert.equal(due(q, 2999).length, 0);
  assert.equal(due(q, 3000).length, 1);
  q = markPlayed(q, item.id, true, 3000);
  assert.equal(q[0].done, true);
  q = compact(q);
  assert.equal(q.length, 0);
});

test("熔断：3 次失败 → open；冷却后 half-open 探测成功 → closed", () => {
  let b: Breaker = { state: "closed", failures: 0, probes: 0, openedAt: 0 };
  b = trip(b, false, 1000);
  b = trip(b, false, 1100);
  b = trip(b, false, 1200);
  assert.equal(b.state, "open"); // openedAt = 1200
  assert.equal(allow(b, 1300).ok, false); // 冷却中拒绝
  const probe = allow(b, 1200 + BREAKER_COOLDOWN + 1);
  assert.equal(probe.ok, true);
  b = trip(probe.breaker, true, 1200 + BREAKER_COOLDOWN + 2);
  assert.equal(b.state, "closed");
});

const BREAKER_COOLDOWN = 30_000;

test("供需杠杆：供不应求 / 过剩 / 平衡", () => {
  assert.equal(lever({ demandCount: 10, supplyCount: 3 }).signal, "thin-supply");
  assert.equal(lever({ demandCount: 3, supplyCount: 10 }).signal, "glut");
  assert.equal(lever({ demandCount: 5, supplyCount: 5 }).signal, "balanced");
});

test("降级四部曲：逐级降级直到成功", () => {
  const { value, log } = degrades([
    { name: "llm", run: () => null },
    { name: "规则", run: () => "fallback" },
  ]);
  assert.equal(value, "fallback");
  assert.equal(log[0], "✗ llm（无结果）");
  assert.equal(log[1], "✓ 规则");
});

test("哈希存证：append 链 + 校验 + 中间篡改检出", () => {
  let lake = lakeAppend([], "wave", { id: 1 }, 1000);
  lake = lakeAppend(lake, "claim", { id: 2 }, 2000);
  lake = lakeAppend(lake, "pay", { id: 3 }, 3000);
  assert.equal(lakeVerify(lake).ok, true);
  const tampered = lake.map((r, i) => (i === 1 ? { ...r, payload: { id: 99 } } : r));
  const v = lakeVerify(tampered);
  assert.equal(v.ok, false);
  assert.equal(v.brokenAt, 1);
});

test("AB：按用户哈希均匀分流 + 获胜判定", () => {
  const variants = [{ id: "A", label: "变体A" }, { id: "B", label: "变体B" }];
  const pick = pickVariant("user-42", variants);
  assert.ok(["A", "B"].includes(pick.id));
  const w = abWinner(
    [{ variantId: "A", metric: 80 }],
    [{ variantId: "B", metric: 50 }],
    10
  );
  assert.equal(w.winner, "A");
  const tie = abWinner([{ variantId: "A", metric: 55 }], [{ variantId: "B", metric: 50 }], 10);
  assert.equal(tie.winner, "tie");
});

// ---------- Part D：五级容灾分流器（L6-M3）----------

const ALL_LEVELS: DegradationLevel[] = ["NORMAL", "DROP_NON_CORE", "RATE_LIMIT_QUEUE", "PRESERVE_CORE", "READ_ONLY"];
const ALL_CATEGORIES: SystemActionCategory[] = ["CRITICAL_SOS", "CORE_FULFILLMENT", "NEW_DEMAND", "NON_CORE_ANALYTICS", "GENERAL_READ"];

test("容灾矩阵：NORMAL 全量放行（5 类全绿）", () => {
  for (const cat of ALL_CATEGORIES) {
    const d = evaluateDegradationGate("NORMAL", cat);
    assert.equal(d.isAllowed, true, `${cat} 应放行`);
    assert.equal(d.httpStatus, undefined);
  }
});

test("容灾矩阵：DROP_NON_CORE 仅阻断非核心分析（503 NON_CORE_SERVICES_DEGRADED）", () => {
  const blocked = evaluateDegradationGate("DROP_NON_CORE", "NON_CORE_ANALYTICS");
  assert.equal(blocked.isAllowed, false);
  assert.equal(blocked.httpStatus, 503);
  assert.equal(blocked.errorCode, "NON_CORE_SERVICES_DEGRADED");
  for (const cat of ["CRITICAL_SOS", "CORE_FULFILLMENT", "NEW_DEMAND", "GENERAL_READ"] as const) {
    assert.equal(evaluateDegradationGate("DROP_NON_CORE", cat).isAllowed, true, `${cat} 应放行`);
  }
});

test("容灾矩阵：RATE_LIMIT_QUEUE 新需求限流（429 RATE_LIMITED_PLEASE_RETRY + Retry-After 5）", () => {
  const blocked = evaluateDegradationGate("RATE_LIMIT_QUEUE", "NEW_DEMAND");
  assert.equal(blocked.isAllowed, false);
  assert.equal(blocked.httpStatus, 429);
  assert.equal(blocked.errorCode, "RATE_LIMITED_PLEASE_RETRY");
  assert.equal(blocked.retryAfterSeconds, 5);
  for (const cat of ["CRITICAL_SOS", "CORE_FULFILLMENT", "NON_CORE_ANALYTICS", "GENERAL_READ"] as const) {
    assert.equal(evaluateDegradationGate("RATE_LIMIT_QUEUE", cat).isAllowed, true, `${cat} 应放行`);
  }
});

test("容灾矩阵：PRESERVE_CORE 仅保 SOS + 在途履约", () => {
  assert.equal(evaluateDegradationGate("PRESERVE_CORE", "CRITICAL_SOS").isAllowed, true);
  assert.equal(evaluateDegradationGate("PRESERVE_CORE", "CORE_FULFILLMENT").isAllowed, true);
  for (const cat of ["NEW_DEMAND", "NON_CORE_ANALYTICS", "GENERAL_READ"] as const) {
    const d = evaluateDegradationGate("PRESERVE_CORE", cat);
    assert.equal(d.isAllowed, false, `${cat} 应阻断`);
    assert.equal(d.httpStatus, 503);
    assert.equal(d.errorCode, "SYSTEM_PRESERVING_CORE_ONLY");
  }
});

test("容灾矩阵：READ_ONLY 仅放行 SOS 与只读，阻断一切写操作", () => {
  assert.equal(evaluateDegradationGate("READ_ONLY", "CRITICAL_SOS").isAllowed, true);
  assert.equal(evaluateDegradationGate("READ_ONLY", "GENERAL_READ").isAllowed, true);
  for (const cat of ["CORE_FULFILLMENT", "NEW_DEMAND", "NON_CORE_ANALYTICS"] as const) {
    const d = evaluateDegradationGate("READ_ONLY", cat);
    assert.equal(d.isAllowed, false, `${cat} 应阻断`);
    assert.equal(d.httpStatus, 503);
    assert.equal(d.errorCode, "SYSTEM_READ_ONLY_MAINTENANCE");
  }
});

test("容灾矩阵：非法等级/类别回落 NORMAL 放行（确定性兜底）", () => {
  assert.equal(evaluateDegradationGate("UNKNOWN" as DegradationLevel, "NEW_DEMAND").isAllowed, true);
  assert.equal(evaluateDegradationGate("NORMAL", "UNKNOWN" as SystemActionCategory).isAllowed, true);
});

test("SOS 免死：一键 SOS 在全部 5 个等级下 100% 无条件放行", () => {
  for (const level of ALL_LEVELS) {
    const d = evaluateDegradationGate(level, "CRITICAL_SOS");
    assert.equal(d.isAllowed, true, `${level} 下 SOS 必须放行`);
    assert.equal(d.httpStatus, undefined);
  }
});

test("25 组合全矩阵断言：5 等级 × 5 类别 确定性一致", () => {
  const expectAllowed: Record<DegradationLevel, SystemActionCategory[]> = {
    NORMAL: [...ALL_CATEGORIES],
    DROP_NON_CORE: ["CRITICAL_SOS", "CORE_FULFILLMENT", "NEW_DEMAND", "GENERAL_READ"],
    RATE_LIMIT_QUEUE: ["CRITICAL_SOS", "CORE_FULFILLMENT", "NON_CORE_ANALYTICS", "GENERAL_READ"],
    PRESERVE_CORE: ["CRITICAL_SOS", "CORE_FULFILLMENT"],
    READ_ONLY: ["CRITICAL_SOS", "GENERAL_READ"],
  };
  for (const level of ALL_LEVELS) {
    for (const cat of ALL_CATEGORIES) {
      const d = evaluateDegradationGate(level, cat);
      assert.equal(
        d.isAllowed,
        expectAllowed[level].includes(cat),
        `${level}/${cat} 期望放行=${expectAllowed[level].includes(cat)}`
      );
    }
  }
});

test("路径分类：SOS / 在途履约 / 新需求 / 非核心分析 / 一般读", () => {
  assert.equal(classifyApiPath("/api/sos/trigger", "POST"), "CRITICAL_SOS");
  assert.equal(classifyApiPath("/api/sos/trigger/2", "POST"), "CRITICAL_SOS");
  assert.equal(classifyApiPath("/api/orders/w1/transit", "POST"), "CORE_FULFILLMENT");
  assert.equal(classifyApiPath("/api/orders/w1/transit", "GET"), "CORE_FULFILLMENT");
  assert.equal(classifyApiPath("/api/waves/w9/claim", "POST"), "CORE_FULFILLMENT");
  assert.equal(classifyApiPath("/api/demands", "POST"), "NEW_DEMAND");
  assert.equal(classifyApiPath("/api/waves", "POST"), "NEW_DEMAND");
  assert.equal(classifyApiPath("/api/demands", "GET"), "GENERAL_READ");
  assert.equal(classifyApiPath("/api/admin/bi", "POST"), "NON_CORE_ANALYTICS");
  assert.equal(classifyApiPath("/api/ai/inspect-echo", "POST"), "NON_CORE_ANALYTICS");
  assert.equal(classifyApiPath("/api/chat", "POST"), "GENERAL_READ");
  assert.equal(classifyApiPath("/api/orders", "GET"), "GENERAL_READ");
  assert.equal(classifyApiPath("/api/health", "GET"), "GENERAL_READ");
});

test("全局等级控制器：内存态 set/get 幂等（不落盘）", () => {
  configureResiliencePersistence(null);
  const before = getGlobalDegradationLevel();
  setGlobalDegradationLevelMemory("DROP_NON_CORE");
  assert.equal(getGlobalDegradationLevel(), "DROP_NON_CORE");
  setGlobalDegradationLevelMemory(before);
  assert.equal(getGlobalDegradationLevel(), before);
});

test("全局等级控制器：注入文件持久化适配器 + 重读回源（模拟 proxy 跨 bundle 冷读）", () => {
  const dir = mkdtempSync(join(tmpdir(), "resilience-test-"));
  const stateFile = join(dir, "state.json");
  const filePersistence: ResiliencePersistence = {
    read() {
      try {
        const raw = readFileSync(stateFile, "utf8");
        const parsed = JSON.parse(raw) as { level?: unknown };
        return (typeof parsed.level === "string" ? parsed.level : null) as DegradationLevel | null;
      } catch {
        return null;
      }
    },
    write(level) {
      try {
        writeFileSync(stateFile, JSON.stringify({ level, updatedAt: new Date().toISOString() }), "utf8");
        return true;
      } catch {
        return false;
      }
    },
  };
  configureResiliencePersistence(filePersistence);
  try {
    const r = setGlobalDegradationLevel("PRESERVE_CORE");
    assert.equal(r.persisted, true);
    const raw = JSON.parse(readFileSync(stateFile, "utf8")) as { level: string };
    assert.equal(raw.level, "PRESERVE_CORE");
    // 模拟另一 bundle（proxy）冷启动：仅依赖持久化层读到等级
    configureResiliencePersistence(filePersistence);
    setGlobalDegradationLevelMemory("NORMAL");
    assert.equal(getGlobalDegradationLevel(), "PRESERVE_CORE");
    // get 只读不写内存：删除文件后回落内存值（proxy 默认 NORMAL → 全量放行）
    rmSync(stateFile, { force: true });
    setGlobalDegradationLevelMemory("NORMAL");
    assert.equal(getGlobalDegradationLevel(), "NORMAL");
  } finally {
    configureResiliencePersistence(null);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("全局等级控制器：持久化文件损坏时回落本进程内存显式值（SET 权威）", () => {
  const dir = mkdtempSync(join(tmpdir(), "resilience-test-"));
  const stateFile = join(dir, "state.json");
  writeFileSync(stateFile, "not-json{{{", "utf8");
  const filePersistence: ResiliencePersistence = {
    read() {
      try {
        const raw = readFileSync(stateFile, "utf8");
        const parsed = JSON.parse(raw) as { level?: unknown };
        return (typeof parsed.level === "string" ? parsed.level : null) as DegradationLevel | null;
      } catch {
        return null;
      }
    },
    write() {
      return false;
    },
  };
  configureResiliencePersistence(filePersistence);
  try {
    // 本进程显式 SET（admin 切换）写入内存；文件读失败 → 回落该内存值
    setGlobalDegradationLevelMemory("READ_ONLY");
    assert.equal(getGlobalDegradationLevel(), "READ_ONLY");
  } finally {
    configureResiliencePersistence(null);
    rmSync(dir, { recursive: true, force: true });
  }
});

test("全局等级控制器：持久化文件缺失时回落默认 NORMAL（新进程/删文件即为恢复）", () => {
  const dir = mkdtempSync(join(tmpdir(), "resilience-test-"));
  const stateFile = join(dir, "missing.json"); // 不存在
  const filePersistence: ResiliencePersistence = {
    read() {
      try {
        const raw = readFileSync(stateFile, "utf8");
        const parsed = JSON.parse(raw) as { level?: unknown };
        return (typeof parsed.level === "string" ? parsed.level : null) as DegradationLevel | null;
      } catch {
        return null;
      }
    },
    write() {
      return true;
    },
  };
  configureResiliencePersistence(filePersistence);
  try {
    // 模拟 proxy 新 bundle 冷启动：内存默认 NORMAL，文件不存在 → NORMAL（网关全量放行）
    setGlobalDegradationLevelMemory("NORMAL");
    assert.equal(getGlobalDegradationLevel(), "NORMAL");
  } finally {
    configureResiliencePersistence(null);
    rmSync(dir, { recursive: true, force: true });
  }
});