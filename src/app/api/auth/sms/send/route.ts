import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { setSmsCode } from "@/lib/sms-code-store";
import { checkRateLimit, rateLimitResponse, RULE_SMS } from "@/lib/rate-limit";
import {
  buildAliyunSmsChannel,
  executeWithFallback,
} from "@/adapters/gateway/multi-channel-gateway";

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

  // 轨道 B（非白名单真实号）：阿里云真发，fail-closed。
  // 生产链显式指定 [aliyun] 单通道：严禁混入 LOCAL_MOCK（其永成功，
  // 会造成"显示成功但用户收不到码"的静默锁死）。
  if (!isSmsMockWhitelisted(phone)) {
    return await sendRealSmsCode(phone);
  }

  const code = "888888";
  setSmsCode(phone, code);

  return NextResponse.json({
    success: true,
    message: "验证码已发送",
    mockCode: code,
  });
}

/**
 * 真实短信下发：6 位随机真码 → 阿里云单通道 → 存盘（TTL 300s）。
 * 成功回 200 且绝不回显验证码；Key 缺/发送抛错 → 503。
 */
async function sendRealSmsCode(phone: string) {
  const hasCredentials = Boolean(
    process.env.ALIYUN_SMS_ACCESS_KEY_ID ?? process.env.ALIYUN_SMS_ACCESS_KEY,
  );
  if (!hasCredentials) {
    return NextResponse.json(
      {
        success: false,
        error: "SMS_GATEWAY_NOT_CONFIGURED",
        message: "短信网关未配置或服务暂不可用",
      },
      { status: 503 },
    );
  }

  const code = randomInt(100000, 1000000).toString();
  try {
    await executeWithFallback([buildAliyunSmsChannel()], {
      phone,
      title: "验证码",
      content: code,
      code,
    }, "sms:verify-code");
  } catch (err) {
    console.error("SMS_SEND_FAILED:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        success: false,
        error: "SMS_SEND_FAILED",
        message: "短信发送失败，请稍后重试",
      },
      { status: 503 },
    );
  }

  setSmsCode(phone, code);
  return NextResponse.json({ success: true, message: "验证码已发送" });
}
