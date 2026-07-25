import { NextResponse } from "next/server";
import { setSmsCode } from "@/lib/sms-code-store";
import { checkRateLimit, rateLimitResponse, RULE_SMS } from "@/lib/rate-limit";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

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

  const code = "888888";
  setSmsCode(phone, code);
  console.log(`[SMS MOCK] 手机号: ${phone} 验证码: ${code}`);

  return NextResponse.json({
    success: true,
    message: "验证码已发送",
    mockCode: code,
  });
}
