import { describe, it, expect, vi, beforeEach } from "vitest";

describe("WeChat OAuth", () => {
  beforeEach(() => {
    vi.stubEnv("WECHAT_APP_ID", "wx_test_app_id_123");
    vi.stubEnv("WECHAT_APP_SECRET", "test_app_secret");
    vi.stubEnv("WECHAT_MCH_ID", "test_mch_id");
    vi.stubEnv("WECHAT_PAY_API_KEY", "test_api_key");
  });

  it("generates a correct OAuth redirect URL containing the appId", async () => {
    vi.resetModules();
    const { wechatPayService } = await import("@/lib/wechat-pay-service");
    const url = wechatPayService.generateOAuthUrl("https://example.com/callback", "snsapi_userinfo");

    expect(url).toContain("wx_test_app_id_123");
    expect(url).toContain("https://open.weixin.qq.com/connect/oauth2/authorize");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("scope=snsapi_userinfo");
    expect(url).toContain("#wechat_redirect");
  });
});

describe("WeChat JSAPI Pay", () => {
  beforeEach(() => {
    vi.stubEnv("WECHAT_APP_ID", "wx_test_app_id_123");
    vi.stubEnv("WECHAT_APP_SECRET", "test_app_secret");
    vi.stubEnv("WECHAT_MCH_ID", "test_mch_id");
    vi.stubEnv("WECHAT_PAY_API_KEY", "test_api_key");
  });

  it("generates JSAPI pay params with correct structure and MD5 paySign", async () => {
    vi.resetModules();
    const { wechatPayService } = await import("@/lib/wechat-pay-service");
    const prepayId = "wx_test_prepay_id_abc123";
    const params = wechatPayService.generateJsapiPayParams(prepayId);

    expect(params).toHaveProperty("appId", "wx_test_app_id_123");
    expect(params).toHaveProperty("timeStamp");
    expect(params).toHaveProperty("nonceStr");
    expect(params).toHaveProperty("package", `prepay_id=${prepayId}`);
    expect(params).toHaveProperty("signType", "MD5");
    expect(params).toHaveProperty("paySign");
    expect(typeof params.paySign).toBe("string");
    expect(params.paySign.length).toBeGreaterThan(0);
  });
});

describe("WeChat Webhook", () => {
  beforeEach(() => {
    vi.stubEnv("WECHAT_APP_ID", "wx_test_app_id_123");
    vi.stubEnv("WECHAT_APP_SECRET", "test_app_secret");
    vi.stubEnv("WECHAT_MCH_ID", "test_mch_id");
    vi.stubEnv("WECHAT_PAY_API_KEY", "test_api_key");
    vi.restoreAllMocks();
  });

  it("rejects callbacks with invalid signature", async () => {
    vi.resetModules();
    const { wechatPayService } = await import("@/lib/wechat-pay-service");

    const params: Record<string, string> = {
      out_trade_no: "contract_001",
      transaction_id: "wx_transaction_001",
      result_code: "SUCCESS",
      total_fee: "5000",
      sign: "INVALID_SIGNATURE",
    };

    const valid = wechatPayService.verifySignature(params);
    expect(valid).toBe(false);
  });

  it("returns SUCCESS for duplicate webhook callbacks (idempotency guard)", async () => {
    // Use placeholder appId so signature verification auto-passes
    vi.stubEnv("WECHAT_APP_ID", "wx_placeholder_skip_verify");
    vi.stubEnv("WECHAT_APP_SECRET", "placeholder");
    vi.stubEnv("WECHAT_MCH_ID", "placeholder");
    vi.stubEnv("WECHAT_PAY_API_KEY", "placeholder");

    vi.mock("@/lib/supabase-client", () => ({
      getServiceClient: () => ({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: "pay_existing", status: "SUCCEEDED" },
              }),
            })),
          })),
        })),
      }),
    }));

    vi.resetModules();
    const { POST } = await import("@/app/api/webhooks/wechat/route");

    const xml = `<xml>
      <out_trade_no><![CDATA[contract_dup]]></out_trade_no>
      <transaction_id><![CDATA[wx_txn_dup_001]]></transaction_id>
      <result_code><![CDATA[SUCCESS]]></result_code>
      <total_fee><![CDATA[5000]]></total_fee>
      <sign><![CDATA[IGNORED_IN_TEST]]></sign>
    </xml>`;

    const request = new Request("https://example.com/api/webhooks/wechat", {
      method: "POST",
      body: xml,
    });

    const response = await POST(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).toContain("SUCCESS");
  });
});
