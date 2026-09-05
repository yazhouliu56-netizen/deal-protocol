import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";

function getWechatOpenId(code: string): Promise<string> {
  const appId = process.env.WECHAT_APP_ID || "wx_placeholder";
  const appSecret = process.env.WECHAT_APP_SECRET || "secret_placeholder";

  if (appId.includes("placeholder")) {
    return Promise.resolve(`mock_openid_${code.slice(0, 8)}`);
  }

  const url = `https://api.weixin.qq.com/sns/oauth2/access_token?appid=${appId}&secret=${appSecret}&code=${code}&grant_type=authorization_code`;
  return fetch(url)
    .then((r) => r.json() as Promise<{ openid?: string; errmsg?: string }>)
    .then((data) => {
      if (!data.openid) throw new Error(data.errmsg || "Failed to get openid");
      return data.openid;
    });
}

/**
 * openid → profiles.name 内部映射标识（零 DDL）。
 * live 实测列：profiles 无 wechat_openid/roles/email 列，role 白名单含 'user'，
 * phone 可空 —— 写入严格限定 {id, name, role} 三键，杜绝 500。
 * 注意：本 stub 不签发会话（真实 AppID 缺席，Mock 流程）；users 行与会话签发
 * 留待 P8 真凭据 + 绑手机链路（sms/verify 回填分支已就绪）。
 */
export function buildWechatProfileName(openid: string): string {
  const tail = openid.replace(/[^a-zA-Z0-9_-]/g, "").slice(-32) || "unknown";
  return `wx_${tail}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  try {
    const wechatOpenid = await getWechatOpenId(code);
    const profileName = buildWechatProfileName(wechatOpenid);
    const svc = getServiceClient();

    const { data: existing } = await svc
      .from("profiles")
      .select("id")
      .eq("name", profileName)
      .maybeSingle();

    if (!existing) {
      // id 显式赋值：profiles.id 无默认值假设不可信，不赌表定义。
      const created = await svc.from("profiles").insert({
        id: crypto.randomUUID(),
        name: profileName,
        role: "user",
      }).select("id").single();

      if (created.error) {
        console.warn("WeChat profile creation warning:", created.error.message);
      }
    }

    return NextResponse.redirect(new URL("/?auth=open", request.url));
  } catch (err) {
    console.error("WeChat OAuth callback error:", err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent((err instanceof Error ? err.message : String(err)))}`, request.url));
  }
}
