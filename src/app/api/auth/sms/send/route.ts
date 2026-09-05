import { NextResponse } from "next/server";
import { setSmsCode } from "@/lib/sms-code-store";
import { checkRateLimit, rateLimitResponse, RULE_SMS } from "@/lib/rate-limit";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * P0 生产风控：Mock 验证码 888888 仅限测试号段。
 * 13000000000~13000000099 为未分配测试号，真机联调专用。
 */
export const SMS_MOCK_WHITELIST_RE = /^130000000\d{2}$/;

export function isSmsMockWhitelisted(phone: string): boolean {
  return SMS_MOCK_WHITELIST_RE.test(phone);
}

export async function POST(request: Request) {
  const { phone } = await request.json();

  if (!phone || !PHONE_REGEX.test(phone)) {
    return NextResponse.json(
      { success: false, error: "手机号格式不正确" },
      { status: 400 },
    );
  }

  const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "unknown"
  const ipResult = checkRateLimit(`sms:ip:${ip}`, RULE_SMS)
  if (!ipResult.allowed) return rateLimitResponse(ipResult.resetAt)

  const phoneResult = checkRateLimit(`sms:phone:${phone}`, RULE_SMS)
  if (!phoneResult.allowed) return rateLimitResponse(phoneResult.resetAt)

  // 非白名单真实号：真实网关未接入前一律 fail-closed，严禁伪造成功、
  // 严禁接受 888888 绕过。P8 接入阿里云后在此分支调用真实发送。
  if (!isSmsMockWhitelisted(phone)) {
    return NextResponse.json(
      {
        success: false,
        error: "SMS_GATEWAY_NOT_CONFIGURED",
        message: "短信通道升级中，请稍后重试",
      },
      { status: 503 },
    );
  }

  const code = "888888";
  setSmsCode(phone, code);

  return NextResponse.json({
    success: true,
    message: "验证码已发送",
    mockCode: code,
  });
}
