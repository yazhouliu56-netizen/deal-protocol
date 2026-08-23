import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import {
  advanceLifecycle,
  type AdvanceResult,
} from "@/base/ammo/runner";
import type { IAmmoDefinition } from "@/types/ammo-schema";

export const dynamic = "force-dynamic";

/**
 * 服务端权威跃迁端点（Step 2 核心接电 · P0-A / 红线 1 隔离墙）。
 *
 * POST /api/orders/[id]/transition    （[id] = order_no = 客户端 wave.id）
 * Headers: X-Idempotency-Key?（离线队列重放防重 —— 红线 5）
 * Body: { toState, expectedVersion, ammoSnapshot?, payload?, termination? }
 *
 * 状态与资金计算 100% 委托 runner.advanceLifecycle 纯函数（红线 1：路由零
 * 手写分账/状态跳跃）；ammoSnapshot 复用快照冻结机制——动态弹药在客户端
 * registry，随请求冻结传输（MVP 信任边界：生产换服务端权威注册表）。
 * CAS 双保险：runner 版本比对 + UPDATE ... WHERE version=expected 受影响行数
 * 校验；冲突一律 409 OPTIMISTIC_LOCK_CONFLICT。
 * SETTLED 终局按 ledger 自动落库 split_records（uniq_split_out_order 幂等）。
 */

interface TransitionBody {
  /** 客户端投影态（仅审计比对；权威 from 以数据库行为准）。 */
  fromState?: string;
  toState: string;
  expectedVersion: number;
  /** 弹药整弹快照（快照冻结机制 · 热更新免疫）。 */
  ammoSnapshot?: IAmmoDefinition;
  payload?: Record<string, unknown>;
  termination?: { kind: string; payload?: Record<string, unknown> };
  transitionReason?: string;
}

function conflict(detail: unknown) {
  return NextResponse.json(
    { error: "OPTIMISTIC_LOCK_CONFLICT", detail },
    { status: 409 },
  );
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id: orderNo } = await ctx.params;

  let body: TransitionBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const { toState, expectedVersion } = body ?? {};
  if (!toState || typeof expectedVersion !== "number") {
    return NextResponse.json(
      { error: "missing-required-fields", required: ["toState", "expectedVersion"] },
      { status: 400 },
    );
  }

  const db = getServiceClient();

  // ── 幂等闸门（红线 5）：同键重放直接返回首次结果，零副作用。
  //    置于载荷校验之前 —— 重放请求允许缺省快照等冗余载荷。──
  const idempotencyKey = request.headers.get("x-idempotency-key");
  if (idempotencyKey) {
    const replayed = await db
      .from("order_state_logs")
      .select("*")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (replayed.data) {
      const reread = await db.from("orders").select("*").eq("order_no", orderNo).maybeSingle();
      return NextResponse.json({
        idempotentReplay: true,
        state: reread.data?.status ?? replayed.data.to_state,
        version: reread.data?.version ?? replayed.data.version_at_trans + 1,
        firstCommittedAt: replayed.data.created_at,
      });
    }
  }



  /**
   * expectedVersion >= 0：调用方携带读取快照（全量 CAS）；
   * expectedVersion < 0（write-behind 默认 -1）：客户端免维护版本，
   * 比对跳过、写回 WHERE version=db.version 仍兜底（乐观锁真值在服务端）。
   */
  const clientExpected =
    typeof expectedVersion === "number" && expectedVersion >= 0
      ? expectedVersion
      : undefined;

  // ── 读权威行（from 以数据库为准，不信客户端投影）──
  const current = await db.from("orders").select("*").eq("order_no", orderNo).maybeSingle();
  if (!current.data) {
    return NextResponse.json({ error: "order-not-found", orderNo }, { status: 404 });
  }
  const row = current.data as {
    status: string;
    version: number;
    total_amount: number;
    payable_amount: number;
    ammo_id: string | null;
    kind: string;
  };

  // 快照冻结机制：服务端 registry 无动态弹药，整弹快照必须随请求冻结传输
  // （MVP 信任边界；生产换服务端权威注册表按 ammo_id 取快照）
  if (!body?.ammoSnapshot?.ammoId || !Array.isArray(body.ammoSnapshot.fiveStateHooks)) {
    return NextResponse.json(
      { error: "missing-ammo-snapshot", detail: "ammoSnapshot{ammoId,fiveStateHooks} is required" },
      { status: 400 },
    );
  }
  const ammoSnapshot = body.ammoSnapshot;
  // 客户端投影态与权威态漂移 → 让调用方重读后再试（乐观锁语义的一部分）
  if (body.fromState && body.fromState !== row.status) {
    return conflict({
      reason: "STATE_DRIFT",
      clientFrom: body.fromState,
      authoritativeFrom: row.status,
    });
  }

  // ── runner 权威规则校验（跃迁矩阵/BEFORE/AFTER 钩子/熔断/资金守恒）──
  let result: AdvanceResult;
  try {
    result = await advanceLifecycle({
      ammo: ammoSnapshot,
      ammoSnapshot,
      orderId: orderNo,
      from: row.status as never,
      to: toState as never,
      currentVersion: row.version,
      ...(clientExpected !== undefined ? { expectedVersion: clientExpected } : {}),
      ...(body.payload ? { payload: body.payload } : {}),
      ...(body.termination
        ? { termination: body.termination as never }
        : {}),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "runner-threw", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  if (!result.ok) {
    if (result.reason?.includes("OPTIMISTIC_LOCK_VERSION_CONFLICT")) return conflict(result.reason);
    if (result.reason?.startsWith("illegal-transition")) {
      return NextResponse.json({ error: "ILLEGAL_TRANSITION", detail: result.reason }, { status: 422 });
    }
    return NextResponse.json(
      { error: "TRANSITION_BLOCKED", detail: result.reason, hookOutcomes: result.hookOutcomes },
      { status: 422 },
    );
  }

  // ── CAS 写回（双保险）：WHERE version=expected 受影响 0 行 = 并发已提交 ──
  const updated = await db
    .from("orders")
    .update({ status: result.state, version: result.nextVersion, updated_at: new Date().toISOString() })
    .eq("order_no", orderNo)
    .eq("version", row.version)
    .select("order_no")
    .maybeSingle();
  if (!updated.data) return conflict(`expected ${row.version} but row moved`);

  // ── 审计留痕（含幂等键唯一约束兜底防重放）──
  const hookSignature = result.hookOutcomes
    .map((h) => `${h.hookId}:${h.ok ? "ok" : `fail(${h.fallbackUsed})`}`)
    .join("|")
    .slice(0, 128);
  const logRow: Record<string, unknown> = {
    order_no: orderNo,
    from_state: row.status,
    to_state: result.state,
    version_at_trans: row.version,
    operator_type: "system",
    operator_id: "orders-transition-api",
    hook_name: result.hookOutcomes[0]?.hookId,
    hook_payload: body.payload ? JSON.parse(JSON.stringify(body.payload)) : null,
    hook_signature: hookSignature || null,
    transition_reason:
      body.transitionReason ??
      (result.termination ? `TERMINATION_${result.termination.kind}` : "CLIENT_TRANSITION"),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
  };
  await db.from("order_state_logs").insert(logRow);

  // ── SETTLED 终局：ledger 落 split_records（每接收方一行；uniq 幂等）──
  let ledger: unknown = null;
  if (result.state === "SETTLED" && idempotencyKey) {
    ledger =
      (result.afterData as Array<{ settlementLedger?: unknown }>).find(
        (d) => d && typeof d === "object" && "settlementLedger" in d,
      )?.settlementLedger ?? null;
    if (ledger && typeof ledger === "object") {
      const l = ledger as {
        split?: { providerIncome?: number; platformIncome?: number; insuranceFee?: number };
        refund?: { payToProvider?: number; platformFee?: number };
        providerIncome: number;
        platformIncome: number;
      };
      const outBase = `${idempotencyKey}`.slice(0, 40);
      const rows = [
        {
          split_no: `sp-${outBase}-prov`.slice(0, 32),
          order_no: orderNo,
          out_order_no: `${outBase}-prov`,
          receiver_mchid: "PROVIDER",
          receiver_type: "PROVIDER",
          split_amount: Math.round(l.split?.providerIncome ?? l.refund?.payToProvider ?? l.providerIncome),
        },
        {
          split_no: `sp-${outBase}-plat`.slice(0, 32),
          order_no: orderNo,
          out_order_no: `${outBase}-plat`,
          receiver_mchid: "PLATFORM",
          receiver_type: "PLATFORM",
          split_amount: Math.round(l.split?.platformIncome ?? l.refund?.platformFee ?? l.platformIncome),
        },
        ...(l.split?.insuranceFee
          ? [{
              split_no: `sp-${outBase}-insr`.slice(0, 32),
              order_no: orderNo,
              out_order_no: `${outBase}-insr`,
              receiver_mchid: "INSURER",
              receiver_type: "INSURER",
              split_amount: Math.round(l.split.insuranceFee),
            }]
          : []),
      ];
      await db.from("split_records").insert(rows);
    }
  }

  return NextResponse.json({
    ok: true,
    state: result.state,
    version: result.nextVersion,
    hookOutcomes: result.hookOutcomes,
    ledger,
  });
}
