import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAliyunSmsChannel,
  signAliyunRpcRequest,
} from "@/adapters/gateway/multi-channel-gateway";

const FIXED = { timestamp: "2026-09-06T00:00:00Z", nonce: "fixed-nonce-001" };
const DUMMY_KEY = "UNIT-TEST-SIGNING-KEY";

function independentSignature(
  signingKey: string,
  timestamp: string,
  nonce: string,
  templateParam: string,
): string {
  const params: Record<string, string> = {
    Format: "JSON",
    AccessKeyId: "test-id",
    SignatureMethod: "HMAC-SHA1",
    SignatureVersion: "1.0",
    SignatureNonce: nonce,
    Timestamp: timestamp,
    Action: "SendSms",
    PhoneNumbers: "13900001111",
    SignName: "TestSign",
    TemplateCode: "SMS_000001",
    TemplateParam: templateParam,
    Version: "2017-05-25",
  };
  const enc = (v: string) =>
    encodeURIComponent(v)
      .replace(/!/g, "%21")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  const canonical = Object.keys(params)
    .sort()
    .map((k) => `${enc(k)}=${enc(params[k])}`)
    .join("&");
  const stringToSign = `GET&${enc("/")}&${enc(canonical)}`;
  return createHmac("sha1", `${signingKey}&`).update(stringToSign, "utf8").digest("base64");
}

function signedUrl() {
  return signAliyunRpcRequest({
    accessKeyId: "test-id",
    accessKeySecret: DUMMY_KEY,
    actionParams: {
      Action: "SendSms",
      PhoneNumbers: "13900001111",
      SignName: "TestSign",
      TemplateCode: "SMS_000001",
      TemplateParam: JSON.stringify({ code: "123456" }),
      Version: "2017-05-25",
    },
    ...FIXED,
  });
}

describe("阿里云 POP RPC 签名", () => {
  it("确定性：同参同输出，含全部必备签名参数", () => {
    const a = signedUrl();
    const b = signedUrl();
    expect(a).toBe(b);
    const url = new URL(a);
    expect(url.hostname).toBe("dysmsapi.aliyuncs.com");
    expect(url.searchParams.get("Signature")).toBeTruthy();
    expect(url.searchParams.get("SignatureNonce")).toBe(FIXED.nonce);
    expect(url.searchParams.get("SignatureMethod")).toBe("HMAC-SHA1");
    expect(url.searchParams.get("TemplateParam")).toBe(JSON.stringify({ code: "123456" }));
  });

  it("签名值与独立实现逐位一致", () => {
    const url = new URL(signedUrl());
    expect(url.searchParams.get("Signature")).toBe(
      independentSignature(DUMMY_KEY, FIXED.timestamp, FIXED.nonce, JSON.stringify({ code: "123456" })),
    );
  });
});

describe("buildAliyunSmsChannel", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.fetch = realFetch;
  });

  it("无凭据快速失败（双变量名均缺席）", async () => {
    vi.stubEnv("ALIYUN_SMS_ACCESS_KEY_ID", "");
    vi.stubEnv("ALIYUN_SMS_ACCESS_KEY", "");
    const ch = buildAliyunSmsChannel();
    await expect(
      ch.execute({ phone: "13900001111", title: "t", content: "c", code: "123456" }),
    ).rejects.toThrow("ALIYUN sms key missing");
  });

  it("成功路径回 messageId；Code!=OK 抛错", async () => {
    vi.stubEnv("ALIYUN_SMS_ACCESS_KEY_ID", "test-id");
    vi.stubEnv("ALIYUN_SMS_ACCESS_KEY_SECRET", DUMMY_KEY);
    const ch = buildAliyunSmsChannel();
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Code: "OK", RequestId: "req-1" }),
    }) as unknown as typeof fetch;
    const ok = await ch.execute({
      phone: "13900001111",
      title: "t",
      content: "c",
      code: "123456",
    });
    expect(ok).toEqual({ success: true, messageId: "req-1" });
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(String(calls[0][0])).toContain("Signature=");
    expect(String(calls[0][0])).toContain("TemplateParam=");

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Code: "isv.BUSINESS_LIMIT_CONTROL", Message: "limited" }),
    }) as unknown as typeof fetch;
    await expect(
      ch.execute({ phone: "13900001111", title: "t", content: "c", code: "123456" }),
    ).rejects.toThrow("isv.BUSINESS_LIMIT_CONTROL");
  });
});
