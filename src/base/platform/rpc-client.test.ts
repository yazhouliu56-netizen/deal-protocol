/**
 * 6 大核心 Supabase 原子 RPC 调用通道测试：
 * 无 transport 时确定性 Mock 降级（degraded=true）/ 注入 transport 走真实
 * 通道（error 透传）/ 异常时回落降级不抛错 / 参数契约与结果形状断言。
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  callRpc,
  mockResultFor,
  rpcGrabDemand,
  rpcInitProviderWallet,
  rpcMatchDemandsHybrid,
  rpcReleaseCheckpoint,
  rpcSlaAutoRelease,
  rpcSubmitWithdrawalRequest,
  type RpcTransport,
} from "./rpc-client.ts";

/* =====================================================================
 * 1. 本地 Mock 降级（无远程 DB 连接时单测 100% 畅通）
 * ===================================================================== */

test("Mock 降级：grab_demand 抢单通道（无 transport → degraded=true 且确定性可断言）", async () => {
  const r = await rpcGrabDemand("d-1", "p-1");
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) {
    assert.equal(r.data.demandId, "d-1");
    assert.equal(r.data.providerId, "p-1");
  }
});

test("Mock 降级：release_checkpoint 里程碑放款通道", async () => {
  const r = await rpcReleaseCheckpoint("c-1", 2);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) {
    assert.equal(r.data.released, true);
    assert.equal(r.data.checkpointIndex, 2);
  }
});

test("Mock 降级：sla_auto_release SLA 自动放款通道", async () => {
  const r = await rpcSlaAutoRelease("c-9");
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) assert.equal(r.data.contractId, "c-9");
});

test("Mock 降级：match_demands_hybrid 混合匹配通道（向量 + LBS 时空召回）", async () => {
  const r = await rpcMatchDemandsHybrid([0.1, 0.2, 0.3], 39.9, 116.4, 5);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) assert.deepEqual(r.data.candidates, []);
});

test("Mock 降级：init_provider_wallet 钱包初始化通道（L2-M4 衔接）", async () => {
  const r = await rpcInitProviderWallet("p-7");
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) assert.equal(r.data.initialized, true);
});

test("Mock 降级：submit_withdrawal_request 提现入队通道（L2-M4 统一钱包）", async () => {
  const r = await rpcSubmitWithdrawalRequest("p-7", 120.5);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
  if (r.ok) {
    assert.equal(r.data.status, "pending");
    assert.ok(r.data.requestId.startsWith("MOCK-WDR"));
  }
});

test("mockResultFor：确定性结果（同输入同输出，无随机性）", () => {
  const a = mockResultFor("grab_demand", { p_demand_id: "x" });
  const b = mockResultFor("grab_demand", { p_demand_id: "x" });
  assert.deepEqual(a, b);
  assert.equal(a.grabbed, true);
});

/* =====================================================================
 * 2. 真实 transport 通道（注入 RPC 适配器）
 * ===================================================================== */

test("真实通道：成功路径走 transport（degraded=false，不透传 Mock）", async () => {
  const transport: RpcTransport = {
    rpc: async (fn, args) => {
      assert.equal(fn, "grab_demand");
      assert.deepEqual(args, { p_demand_id: "d-2", p_provider_id: "p-2" });
      return { data: { grabbed: true, assignedAt: "2026-08-15T00:00:00Z" } };
    },
  };
  const r = await rpcGrabDemand("d-2", "p-2", transport);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, false);
});

test("真实通道：RPC error → ok=false 透传错误信息", async () => {
  const transport: RpcTransport = {
    rpc: async () => ({ data: undefined, error: { message: "permission denied" } }),
  };
  const r = await rpcReleaseCheckpoint("c-2", 1, transport);
  assert.equal(r.ok, false);
  assert.equal(r.degraded, false);
  if (!r.ok) assert.equal(r.error, "permission denied");
});

test("真实通道：transport 抛异常 → 回落 Mock 降级（红线 5：不抛未捕获异常）", async () => {
  const transport: RpcTransport = {
    rpc: async () => {
      throw new Error("network down");
    },
  };
  const r = await rpcSlaAutoRelease("c-3", transport);
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
});

test("真实通道：match_demands_hybrid 传参与返回形状", async () => {
  const transport: RpcTransport = {
    rpc: async (fn, args) => {
      assert.deepEqual(args, {
        p_embedding: [0.5],
        p_lat: 39.9,
        p_lng: 116.4,
        p_radius_km: 10,
      });
      return { data: { candidates: [{ id: "d-9", score: 0.92 }] } };
    },
  };
  const r = await rpcMatchDemandsHybrid([0.5], 39.9, 116.4, 10, transport);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal((r.data.candidates as { id: string }[]).length, 1);
});

/* =====================================================================
 * 3. 契约防御
 * ===================================================================== */

test("callRpc 未知函数名：Mock 表兜底仍返回 ok", async () => {
  const r = await callRpc("unknown_fn", {});
  assert.equal(r.ok, true);
  assert.equal(r.degraded, true);
});
