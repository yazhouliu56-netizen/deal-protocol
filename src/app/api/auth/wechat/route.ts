import { NextResponse } from "next/server";
import { wechatPayService } from "@/adapters/payment/wechat-pay-service";
import { getSiteUrl } from "@/lib/site-url";

export async function GET(request: Request) {
  const siteUrl = getSiteUrl();
  const redirectUri = `${siteUrl}/api/auth/wechat/callback`;
  const scope = new URL(request.url).searchParams.get("scope") === "snsapi_base" ? "snsapi_base" : "snsapi_userinfo";

  const oauthUrl = wechatPayService.generateOAuthUrl(redirectUri, scope);
  return NextResponse.redirect(oauthUrl);
}
