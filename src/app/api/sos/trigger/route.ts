import { NextResponse } from "next/server";
import { triggerSOS } from "@/modules/m10-sos/sos-service";
// P0-2 收编：危机链路经 base 确定性引擎（src/base/safe/crisis-tracker.ts）——
// 触发即初始化升级链（TRIGGERED + EPA 通知载荷）+ 位置面包屑入审计轨迹。
import {
  triggerCrisisEscalation,
  type ISosForensicSnapshot,
} from "@/base/safe/crisis-tracker";
// P1-3：权威存证哈希 SSOT（批次 3b「A 写 B 验」——客户端预指纹不可信，服务端重算固化）。
import { computeEvidenceHash } from "@/base/safe/evidence-chain";
import { getSupabase } from "@/lib/supabase-client";

const VALID_LEVELS = [0, 1, 2, 3];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, protocolId, latitude, longitude, note, waveId, snapshot } =
      body as {
        userId?: string;
        protocolId?: string;
        latitude?: number;
        longitude?: number;
        note?: string;
        waveId?: string | null;
        snapshot?: ISosForensicSnapshot | null;
      };

    if (!userId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const lat = Number.isFinite(latitude) ? Number(latitude) : 0;
    const lng = Number.isFinite(longitude) ? Number(longitude) : 0;
    const rawLevel = Number((body as { level?: unknown }).level);
    const level = (VALID_LEVELS.includes(rawLevel) ? rawLevel : 3) as 0 | 1 | 2 | 3;

    // 有单场景（协议键）：M10 五步链——冻结订单 + 平台值班/紧急联系人/暂停接单。
    let frozenAt: string | null = null;
    if (protocolId) {
      const result = await triggerSOS({ userId, protocolId, latitude: lat, longitude: lng });
      frozenAt = result.frozenAt;
    }

    // 权威存证哈希重算（evidence-chain SSOT 规范公式，64 位 hex 防篡改）。
    const eventType = "CRISIS_SOS_TRIGGERED";
    const timestamp = new Date().toISOString();
    const chainKey = waveId ?? protocolId ?? undefined;
    const payloadForHash = snapshot ?? { latitude: lat, longitude: lng, note: note ?? "" };
    const authoritativeHash = computeEvidenceHash(
      chainKey,
      eventType,
      payloadForHash,
      "GENESIS",
      timestamp
    );

    // 危机升级链初始化（TRIGGERED 阶段 + EPA 分诊通知载荷）
    // + 触发点位置面包屑（FIFO 轨迹，非法坐标由 base 拒绝）。
    const nowMs = Date.now();
    const escalation = triggerCrisisEscalation(
      String(snapshot?.crisisId ?? `sos-${userId}-${nowMs}`),
      nowMs,
      level,
    );

    // 有单场景 best-effort 锚点落盘 order_state_logs（hook_payload JSONB 承载快照与权威哈希；
    // 本地沙盒无 orders 行 / 表缺失时静默降级，绝不阻断报警——宪法 #10）。
    let persisted = false;
    if (waveId) {
      try {
        const { error } = await getSupabase()
          .from("order_state_logs")
          .insert({
            order_no: waveId,
            from_state: "SOS",
            to_state: "SOS",
            version_at_trans: 0,
            operator_type: "SYSTEM",
            operator_id: String(userId),
            hook_name: eventType,
            hook_payload: { authoritativeHash, timestamp, snapshot: snapshot ?? null },
            transition_reason: "SOS_FORENSIC_ANCHOR",
            idempotency_key: `sos:${snapshot?.snapshotId ?? `${userId}:${nowMs}`}`,
          });
        persisted = !error;
      } catch {
        persisted = false;
      }
    }

    return NextResponse.json({
      success: true,
      frozenAt: frozenAt ?? new Date(nowMs).toISOString(),
      crisis: {
        escalationPhase: escalation.state.phase,
        escalationLevel: escalation.state.level,
        notification: escalation.notification,
      },
      forensic: {
        eventType,
        chainKey: chainKey ?? null,
        authoritativeHash,
        timestamp,
        persisted,
        trajectoryPoints: snapshot?.trajectoryPayload.pointCount ?? 0,
        audioChunks: snapshot?.audioEvidenceSummary.chunkCount ?? 0,
      },
    });
  } catch (err) {
    console.error("SOS trigger error:", err);
    return NextResponse.json({ error: "SOS 触发失败" }, { status: 500 });
  }
}
