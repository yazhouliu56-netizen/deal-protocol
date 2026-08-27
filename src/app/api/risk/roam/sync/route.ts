import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { createHash } from "node:crypto";

function hashIp(ip: string | undefined): string | null {
  if (!ip || typeof ip !== "string") return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export const GET = withAuth(async (_req, user) => {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("roam_devices")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false });
  if (error) {
    return NextResponse.json({ devices: [], error: error.message }, { status: 200 });
  }
  return NextResponse.json({ devices: data ?? [] });
});

export const POST = withAuth(async (req, user) => {
  const supabase = getServiceClient();
  let body: { device_id?: string; fingerprint?: Record<string, unknown>; user_agent?: string; ip_hash?: string; ip?: string } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const device_id = typeof body.device_id === "string" ? body.device_id.trim() : "";
  if (!device_id) {
    return NextResponse.json({ error: "device_id required" }, { status: 400 });
  }
  const fingerprint = body.fingerprint && typeof body.fingerprint === "object" ? body.fingerprint : {};
  const user_agent = typeof body.user_agent === "string" ? body.user_agent.slice(0, 500) : null;
  const ipHashRaw = typeof body.ip_hash === "string" ? body.ip_hash : body.ip ? hashIp(body.ip) : null;
  const ip_hash = ipHashRaw ? String(ipHashRaw).slice(0, 64) : null;

  // ON CONFLICT (user_id, device_id) 幂等 upsert
  const { error: upsertError } = await supabase.from("roam_devices").upsert(
    {
      user_id: user.id,
      device_id,
      fingerprint,
      user_agent,
      ip_hash,
      last_seen_at: new Date().toISOString(),
      is_active: true,
    },
    { onConflict: "user_id,device_id" }
  );
  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  // 拉全量计算风险（纯函数 riskOf）
  const { data: devices } = await supabase
    .from("roam_devices")
    .select("device_id")
    .eq("user_id", user.id)
    .eq("is_active", true);
  const bindings = (devices ?? []).map((d: { device_id: string }) => ({
    deviceId: d.device_id,
    identityId: user.id,
    firstSeen: 0,
    lastSeen: 0,
  }));
  // 简化：以 device_id 去重计数，同一 user 多 device 场景下 riskOf 需按 device 分组；
  // 此处取当前 device 的同 user 设备数作为 count 代理
  const count = bindings.length;
  const risk = count >= 3 ? "high" : count === 2 ? "watch" : "safe";

  if (risk === "high") {
    await supabase.from("roam_risk_events").insert({
      user_id: user.id,
      device_id,
      event_type: "MULTI_DEVICE_LOGIN",
      payload: { count, fingerprint, user_agent },
    });
  }

  const { data: allDevices } = await supabase
    .from("roam_devices")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("last_seen_at", { ascending: false });

  return NextResponse.json({ ok: true, risk, count, devices: allDevices ?? [] });
});
