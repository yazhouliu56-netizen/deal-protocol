import { NextResponse } from "next/server";
import { wechatPayService } from "@/lib/wechat-pay-service";

export async function GET(request: Request) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const redirectUri = `${siteUrl}/api/auth/wechat/callback`;
  const scope = new URL(request.url).searchParams.get("scope") === "snsapi_base" ? "snsapi_base" : "snsapi_userinfo";

  const oauthUrl = wechatPayService.generateOAuthUrl(redirectUri, scope);
  return NextResponse.redirect(oauthUrl);
}
