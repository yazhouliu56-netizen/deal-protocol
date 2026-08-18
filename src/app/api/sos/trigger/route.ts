import { NextResponse } from "next/server";
import { triggerSOS } from "@/modules/m10-sos/sos-service";
// P0-2 收编：危机链路经 base 确定性引擎（src/base/safe/crisis-tracker.ts）——
// 触发即初始化升级链（TRIGGERED + EPA 通知载荷）+ 位置面包屑入审计轨迹。
import {
  triggerCrisisEscalation,
  recordBreadcrumbPoint,
} from "@/base/safe/crisis-tracker";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, protocolId, latitude, longitude } = body;

    if (!userId || !protocolId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const lat = Number.isFinite(latitude) ? latitude : 0;
    const lng = Number.isFinite(longitude) ? longitude : 0;

    const result = await triggerSOS({
      userId,
      protocolId,
      latitude: lat,
      longitude: lng,
    });

    // P0-2 收编：危机升级链初始化（TRIGGERED 阶段 + EPA 分诊通知载荷）
    // + 触发点位置面包屑（FIFO 轨迹，非法坐标由 base 拒绝）。
    const nowMs = Date.now();
    const escalation = triggerCrisisEscalation(
      `sos-${userId}-${protocolId}`,
      nowMs,
      3,
    );
    const breadcrumb = recordBreadcrumbPoint(
      [],
      { lat, lng, accuracy: 0, timestamp: nowMs },
    );

    return NextResponse.json({
      ...result,
      crisis: {
        escalationPhase: escalation.state.phase,
        escalationLevel: escalation.state.level,
        notification: escalation.notification,
        breadcrumb: breadcrumb.points,
      },
    });
  } catch (err) {
    console.error("SOS trigger error:", err);
    return NextResponse.json({ error: "SOS 触发失败" }, { status: 500 });
  }
}