import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const dynamic = "force-dynamic";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const vapidPub = process.env.VAPID_PUBLIC_KEY;
const vapidPriv = process.env.VAPID_PRIVATE_KEY;
const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:admin@oto.app";

/**
 * PWA 真推（LAUNCH-GAP E 组）：POST /api/push/send
 * body: { title, body?, tag?, icon?, badge?, url?, userId? }
 *  - userId 指定 → 发给该用户全部订阅；省略 → 发给全部订阅。
 * 返回逐订阅发送结果（web-push 端点失败自动清理无效订阅）。
 */
export async function POST(req: NextRequest) {
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: "supabase-not-configured" }, { status: 500 });
  }
  if (!vapidPub || !vapidPriv) {
    return NextResponse.json({ ok: false, error: "vapid-not-configured" }, { status: 500 });
  }
  let body: {
    title?: string;
    body?: string;
    tag?: string;
    icon?: string;
    badge?: string;
    url?: string;
    userId?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }
  const payload = JSON.stringify({
    title: body.title ?? "OTO 空间协议",
    body: body.body ?? "",
    tag: body.tag ?? "oto-push",
    icon: body.icon ?? "/icon-192.png",
    badge: body.badge ?? "/icon-192.png",
    url: body.url ?? "/",
  });

  const supabase = createClient(supabaseUrl, serviceKey);
  let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (body.userId) {
    query = query.eq("user_id", body.userId);
  }
  const { data: subs, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  if (!subs || subs.length === 0) {
    return NextResponse.json({ ok: false, error: "no-subscriptions" }, { status: 404 });
  }

  webpush.setVapidDetails(vapidSubject, vapidPub, vapidPriv);
  const results: { endpoint: string; ok: boolean; error?: string }[] = [];
  const dead: string[] = [];
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      );
      results.push({ endpoint: s.endpoint.slice(0, 24) + "...", ok: true });
    } catch (e) {
      const err = e as { statusCode?: number; body?: string };
      results.push({
        endpoint: s.endpoint.slice(0, 24) + "...",
        ok: false,
        error: err.statusCode ? `HTTP ${err.statusCode}` : String(e),
      });
      // 410 Gone / 404 Not Found → 订阅失效，清理
      if (err.statusCode === 410 || err.statusCode === 404) {
        dead.push(s.endpoint);
      }
    }
  }
  if (dead.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }
  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    cleaned: dead.length,
    results,
  });
}
