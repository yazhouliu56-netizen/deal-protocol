import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * PWA 真推（LAUNCH-GAP E 组）：客户端订阅上报 → push_subscriptions upsert。
 * endpoint 为唯一键：同一浏览器重复订阅幂等覆盖。
 */
export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceKey) {
    // 红线 5：无 Key 时沙盒模拟永不中断（方向 3）
    return NextResponse.json({ ok: true, mocked: true, reason: "supabase-not-configured" });
  }
  let body: { endpoint?: string; p256dh?: string; auth?: string; userId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const { endpoint, p256dh, auth, userId } = body;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ ok: false, error: "missing-fields" }, { status: 400 });
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      user_id: userId ?? "",
      user_agent: req.headers.get("user-agent")?.slice(0, 200) ?? "",
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" }
  );
  if (error) {
    if (error.message.includes("Could not find the table")) {
      return NextResponse.json(
        { ok: false, error: "push-table-not-configured" },
        { status: 501 }
      );
    }
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
