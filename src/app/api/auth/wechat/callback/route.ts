import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-client";
import { wechatPayService } from "@/lib/wechat-pay-service";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", request.url));
  }

  try {
    const wechatOpenid = await getWechatOpenId(code);
    const svc = getServiceClient();

    const { data: existing } = await svc
      .from("profiles")
      .select("id")
      .eq("wechat_openid", wechatOpenid)
      .maybeSingle();

    if (existing) {
      await svc
        .from("profiles")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const baseUser = await svc.from("profiles").insert({
        wechat_openid: wechatOpenid,
        name: `wx_user_${wechatOpenid.slice(-6)}`,
        role: "CUSTOMER",
        roles: JSON.stringify(["CUSTOMER"]),
        created_at: new Date().toISOString(),
      }).select("id").single();

      if (baseUser.error) {
        console.warn("WeChat profile creation warning:", baseUser.error.message);
      }
    }

    return NextResponse.redirect(new URL("/dashboard?auth=wechat_success", request.url));
  } catch (err: any) {
    console.error("WeChat OAuth callback error:", err);
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, request.url));
  }
}
