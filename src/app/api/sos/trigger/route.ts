import { NextResponse } from "next/server";
import { triggerSOS } from "@/modules/m10-sos/sos-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, protocolId, latitude, longitude } = body;

    if (!userId || !protocolId) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const result = await triggerSOS({
      userId,
      protocolId,
      latitude: latitude ?? 0,
      longitude: longitude ?? 0,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("SOS trigger error:", err);
    return NextResponse.json({ error: "SOS 触发失败" }, { status: 500 });
  }
}
