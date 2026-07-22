import crypto from "crypto";

export interface CreatePaymentParams {
  orderId: string;
  amount: number;
  description: string;
  channel: "alipay" | "wechat";
  notifyUrl: string;
  payerId?: string;
}

export interface CreatePaymentResult {
  success: boolean;
  orderId: string;
  payUrl?: string;
  qrCode?: string;
  tradeNo?: string;
  error?: string;
}

export interface NotifyResult {
  success: boolean;
  orderId: string;
  tradeNo: string;
  channel: string;
}

export interface NotifyHeaders {
  [key: string]: string;
}

interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
}

interface WechatConfig {
  appId: string;
  mchId: string;
  apiV3Key: string;
  privateKey: string;
  serialNo: string;
}

export class PaymentManager {
  private static instance: PaymentManager | null = null;

  private alipayConfig: AlipayConfig | null = null;
  private wechatConfig: WechatConfig | null = null;
  private notifyUrl: string = "";
  private sandbox: boolean = false;

  private constructor() {}

  static getInstance(): PaymentManager {
    if (!PaymentManager.instance) {
      PaymentManager.instance = new PaymentManager();
      PaymentManager.instance.init();
    }
    return PaymentManager.instance;
  }

  private init(): void {
    this.sandbox = process.env.PAYMENT_SANDBOX === "true";
    this.notifyUrl = process.env.PAYMENT_NOTIFY_URL || "";

    const alipayAppId = process.env.ALIPAY_APP_ID;
    const alipayPrivateKey = process.env.ALIPAY_PRIVATE_KEY;
    const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;
    if (alipayAppId && alipayPrivateKey && alipayPublicKey) {
      this.alipayConfig = {
        appId: alipayAppId,
        privateKey: alipayPrivateKey.replace(/\\n/g, "\n"),
        alipayPublicKey: alipayPublicKey.replace(/\\n/g, "\n"),
      };
    }

    const wechatAppId = process.env.WECHAT_APP_ID;
    const wechatMchId = process.env.WECHAT_MCH_ID;
    const wechatApiV3Key = process.env.WECHAT_API_KEY_V3;
    const wechatPrivateKey = process.env.WECHAT_PRIVATE_KEY;
    const wechatSerialNo = process.env.WECHAT_SERIAL_NO;
    if (wechatAppId && wechatMchId && wechatApiV3Key && wechatPrivateKey && wechatSerialNo) {
      this.wechatConfig = {
        appId: wechatAppId,
        mchId: wechatMchId,
        apiV3Key: wechatApiV3Key,
        privateKey: wechatPrivateKey.replace(/\\n/g, "\n"),
        serialNo: wechatSerialNo,
      };
    }
  }

  isConfigured(channel: "alipay" | "wechat"): boolean {
    if (channel === "alipay") return this.alipayConfig !== null;
    if (channel === "wechat") return this.wechatConfig !== null;
    return false;
  }

  getAvailableChannels(): string[] {
    const channels: string[] = [];
    if (this.alipayConfig) channels.push("alipay");
    if (this.wechatConfig) channels.push("wechat");
    return channels;
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (params.channel === "alipay") {
      return this.createAlipayPayment(params);
    }
    if (params.channel === "wechat") {
      return this.createWechatPayment(params);
    }
    return { success: false, orderId: params.orderId, error: `Unsupported channel: ${params.channel}` };
  }

  private async createAlipayPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.alipayConfig) {
      return { success: false, orderId: params.orderId, error: "Alipay not configured" };
    }

    const baseUrl = this.sandbox
      ? "https://openapi-sandbox.dl.alipaydev.com/gateway.do"
      : "https://openapi.alipay.com/gateway.do";

    const bizContent = JSON.stringify({
      out_trade_no: params.orderId,
      total_amount: params.amount.toFixed(2),
      subject: params.description,
      product_code: "FAST_INSTANT_TRADE_PAY",
    });

    const paramsMap: Record<string, string> = {
      app_id: this.alipayConfig.appId,
      method: "alipay.trade.page.pay",
      format: "JSON",
      charset: "utf-8",
      sign_type: "RSA2",
      timestamp: new Date().toISOString().replace(/[TZ]/g, " ").trim(),
      version: "1.0",
      notify_url: params.notifyUrl || this.notifyUrl,
      biz_content: bizContent,
    };

    const signStr = Object.keys(paramsMap)
      .sort()
      .map((k) => `${k}=${paramsMap[k]}`)
      .join("&");

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signStr, "utf-8");
    const signature = signer.sign(this.alipayConfig.privateKey, "base64");
    paramsMap.sign = signature;

    const queryString = Object.entries(paramsMap)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    return {
      success: true,
      orderId: params.orderId,
      payUrl: `${baseUrl}?${queryString}`,
      tradeNo: `ali_${params.orderId}_${Date.now()}`,
    };
  }

  private async createWechatPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    if (!this.wechatConfig) {
      return { success: false, orderId: params.orderId, error: "WeChat Pay not configured" };
    }

    const baseUrl = this.sandbox
      ? "https://api.mch.weixin.qq.com/v3/pay/transactions/native"
      : "https://api.mch.weixin.qq.com/v3/pay/transactions/native";

    const body = JSON.stringify({
      mchid: this.wechatConfig.mchId,
      out_trade_no: params.orderId,
      appid: this.wechatConfig.appId,
      description: params.description,
      notify_url: params.notifyUrl || this.notifyUrl,
      amount: {
        total: Math.round(params.amount * 100),
        currency: "CNY",
      },
    });

    const nonce = crypto.randomBytes(16).toString("hex");
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const message = `${timestamp}\n${nonce}\n${body}\n`;

    const signer = crypto.createSign("RSA-SHA256");
    signer.update(message, "utf-8");
    const signature = signer.sign(this.wechatConfig.privateKey, "base64");

    const token = `mchid="${this.wechatConfig.mchId}",nonce_str="${nonce}",timestamp="${timestamp}",serial_no="${this.wechatConfig.serialNo}",signature="${signature}"`;

    let response: Response;
    try {
      response = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `WECHATPAY2-SHA256-RSA2048 ${token}`,
          "User-Agent": "deal-protocol",
          Accept: "application/json",
        },
        body,
      });
    } catch (e) {
      return {
        success: false,
        orderId: params.orderId,
        error: `WeChat Pay request failed: ${e instanceof Error ? e.message : String(e)}`,
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        orderId: params.orderId,
        error: `WeChat Pay API error (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json() as { code_url?: string; h5_url?: string; prepay_id?: string };
    return {
      success: true,
      orderId: params.orderId,
      qrCode: data.code_url,
      payUrl: data.h5_url,
      tradeNo: `wx_${params.orderId}_${Date.now()}`,
    };
  }

  async handleNotify(channel: string, body: string, headers: NotifyHeaders): Promise<NotifyResult> {
    if (channel === "alipay") {
      return this.handleAlipayNotify(body);
    }
    if (channel === "wechat") {
      return this.handleWechatNotify(body, headers);
    }
    throw new Error(`Unsupported notify channel: ${channel}`);
  }

  private async handleAlipayNotify(body: string): Promise<NotifyResult> {
    if (!this.alipayConfig) {
      throw new Error("Alipay not configured");
    }

    const params = new URLSearchParams(body);
    const sign = params.get("sign") || "";
    const signType = params.get("sign_type") || "RSA2";

    const verifiedParams: Record<string, string> = {};
    for (const [k, v] of params.entries()) {
      if (k !== "sign" && k !== "sign_type") {
        verifiedParams[k] = v;
      }
    }

    const signStr = Object.keys(verifiedParams)
      .sort()
      .map((k) => `${k}=${verifiedParams[k]}`)
      .join("&");

    const verifier = crypto.createVerify(signType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1");
    verifier.update(signStr, "utf-8");
    const isValid = verifier.verify(this.alipayConfig.alipayPublicKey, sign, "base64");

    if (!isValid) {
      throw new Error("Alipay notify signature verification failed");
    }

    const tradeStatus = params.get("trade_status");
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      throw new Error(`Unexpected Alipay trade status: ${tradeStatus}`);
    }

    return {
      success: true,
      orderId: params.get("out_trade_no") || "",
      tradeNo: params.get("trade_no") || "",
      channel: "alipay",
    };
  }

  private async handleWechatNotify(body: string, headers: NotifyHeaders): Promise<NotifyResult> {
    if (!this.wechatConfig) {
      throw new Error("WeChat Pay not configured");
    }

    const parsed = JSON.parse(body) as {
      id?: string;
      resource?: {
        algorithm?: string;
        ciphertext?: string;
        associated_data?: string;
        nonce?: string;
      };
    };

    if (!parsed.resource) {
      throw new Error("Invalid WeChat notify body: missing resource");
    }

    const { ciphertext, associated_data, nonce } = parsed.resource;
    if (!ciphertext || !nonce) {
      throw new Error("Invalid WeChat notify body: missing cipher fields");
    }

    const authTag = ciphertext.slice(-32);
    const encryptedData = ciphertext.slice(0, -32);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      this.wechatConfig.apiV3Key.padEnd(32, "0").slice(0, 32),
      nonce,
    );
    decipher.setAAD(Buffer.from(associated_data || "", "utf-8"));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));

    let decrypted: string;
    try {
      const plainBuf = Buffer.concat([
        decipher.update(Buffer.from(encryptedData, "hex")),
        decipher.final(),
      ]);
      decrypted = plainBuf.toString("utf-8");
    } catch (e) {
      throw new Error(`WeChat notify decryption failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const resource = JSON.parse(decrypted) as {
      out_trade_no?: string;
      transaction_id?: string;
      trade_state?: string;
      trade_type?: string;
    };

    if (resource.trade_state && resource.trade_state !== "SUCCESS") {
      throw new Error(`Unexpected WeChat trade state: ${resource.trade_state}`);
    }

    return {
      success: true,
      orderId: resource.out_trade_no || "",
      tradeNo: resource.transaction_id || "",
      channel: "wechat",
    };
  }
}
