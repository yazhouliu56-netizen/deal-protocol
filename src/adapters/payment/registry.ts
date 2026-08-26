import Stripe from "stripe";
import { PaymentManager } from "./payment-core";
import { alipayService } from "./alipay-sandbox-channel";
import { wechatPayService } from "./wechat-pay-service";

/* ═══════════════════════════════════════════════════════════════════
 * P1-5 支付 Provider 统一抽象与注册表（Microkernel 2.0 战役 5 · 参谋部
 * 裁决方案 a：核心三法归一 + queryStatus 可选能力）。
 *
 * 单一抽象：所有支付通道（stripe / alipay / wechat 及沙盒变体）实现
 * IPaymentProvider 并注册进 PaymentRegistry；通道可插拔，调用方零
 * 通道硬编码分支。
 *
 * 等价红线：本文件是既有实现的收编平移层——Stripe 逻辑逐字自
 * src/lib/payment.ts 迁入；alipay/wechat 生产链路薄壳委托
 * payment-core.PaymentManager（验签/签名算法本体零触碰）；
 * Mock/沙盒降级机制（Stripe isMock / manager.sandbox / 沙盒通道占位
 * 放行）全部守恒。
 * ═══════════════════════════════════════════════════════════════════ */

/** 支付状态机（跨通道统一投影）。 */
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

/** 创建支付统一请求。 */
export interface CreatePaymentRequest {
  /** 业务合约/订单号（out_trade_no 语义）。 */
  orderId: string;
  /** 金额（元）。 */
  amount: number;
  /** 商品描述。 */
  description: string;
  /** 付款人 ID。 */
  payerId?: string;
  /** 币种（ISO 小写；缺省 cny）。 */
  currency?: string;
  /** 通道附加元数据（透传渠道侧 metadata）。 */
  metadata?: Record<string, string>;
}

/** 创建支付统一结果（extra 承载通道特有载荷，如微信 JSAPI 签名参数包）。 */
export interface CreatePaymentResult {
  success: boolean;
  status?: PaymentStatus;
  providerPaymentId?: string | null;
  payUrl?: string;
  qrCode?: string;
  clientSecret?: string;
  extra?: Record<string, unknown>;
  error?: string;
}

/** 回调验签统一请求（payload=原始报文；params=已解析表单/XML 键值）。 */
export interface WebhookVerifyRequest {
  payload?: unknown;
  signature?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
}

/** 回调验签统一结果（eventType/raw 供事件分发型 webhook 网关使用）。 */
export interface WebhookVerifyResult {
  success: boolean;
  orderId?: string;
  tradeNo?: string;
  providerPaymentId?: string | null;
  status?: PaymentStatus;
  eventType?: string;
  raw?: unknown;
  error?: string;
}

/** 退款统一请求/结果。 */
export interface RefundRequest {
  providerPaymentId: string;
  amount: number;
}
export interface RefundResult {
  success: boolean;
  refundId?: string | null;
  status?: PaymentStatus;
  error?: string;
}

/** 订单查询统一结果（可选能力 · 首版不写空查询）。 */
export interface PaymentStatusResult {
  success: boolean;
  status: PaymentStatus;
  providerPaymentId?: string;
  paidAmount?: number;
  error?: string;
}

/**
 * 支付通道 Provider 统一契约：核心三法 createPayment / verifyWebhook /
 * refund 强制；queryStatus 为可选扩展——给支付宝/微信凭空编写未经商户
 * 沙盒实测的查询网络请求属于引入未经检验的外部副作用，首版不实现。
 */
export interface IPaymentProvider {
  readonly channel: string;
  /** 通道是否已配置真实密钥（false 时实现内部走沙盒降级）。 */
  isConfigured(): boolean;
  createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult>;
  verifyWebhook(req: WebhookVerifyRequest): Promise<WebhookVerifyResult>;
  refund(req: RefundRequest): Promise<RefundResult>;
  queryStatus?(orderNo: string): Promise<PaymentStatusResult>;
}

/* ── Stripe 生产通道（自 src/lib/payment.ts 逐字平移）──────────────── */

export class StripeChannelProvider implements IPaymentProvider {
  readonly channel = "stripe";
  private client: Stripe | null;
  private isMock: boolean;

  constructor() {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      this.client = null;
      this.isMock = true;
    } else {
      this.client = new Stripe(key, { apiVersion: "2026-06-24.dahlia" });
      this.isMock = false;
    }
  }

  isConfigured(): boolean {
    return !this.isMock;
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    if (this.isMock) {
      return {
        success: true,
        providerPaymentId: `pi_mock_${req.orderId}_${Date.now()}`,
        status: "SUCCEEDED",
      };
    }
    try {
      const intent = await this.client!.paymentIntents.create({
        amount: Math.round(req.amount * 100),
        currency: req.currency ?? "cny",
        description: req.description,
        metadata: {
          contractId: req.orderId,
          payerId: req.payerId ?? "",
          ...req.metadata,
        },
      });
      return {
        success: true,
        providerPaymentId: intent.id,
        status: "PENDING",
        clientSecret: intent.client_secret ?? undefined,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, providerPaymentId: null, status: "FAILED", error: message };
    }
  }

  async refund(req: RefundRequest): Promise<RefundResult> {
    if (this.isMock) {
      return {
        success: true,
        refundId: `refund_${req.providerPaymentId}`,
        status: "SUCCEEDED",
      };
    }
    try {
      const refund = await this.client!.refunds.create({
        payment_intent: req.providerPaymentId,
        amount: Math.round(req.amount * 100),
      });
      return { success: true, refundId: refund.id, status: "SUCCEEDED" };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, refundId: null, status: "FAILED", error: message };
    }
  }

  async parseWebhook(payload: unknown, signature: string): Promise<WebhookVerifyResult> {
    if (!this.client) {
      return {
        success: false,
        error: "Stripe client not initialized (missing STRIPE_SECRET_KEY)",
      };
    }
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      return { success: false, error: "STRIPE_WEBHOOK_SECRET is not set" };
    }
    try {
      const event = this.client.webhooks.constructEvent(
        payload as string | Buffer,
        signature,
        secret,
      );
      const intent = event.data.object as Stripe.PaymentIntent;
      return {
        success: true,
        providerPaymentId: intent.id,
        status: intent.status === "succeeded" ? "SUCCEEDED" : "PENDING",
        eventType: event.type,
        raw: event,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return { success: false, error: message };
    }
  }

  async verifyWebhook(req: WebhookVerifyRequest): Promise<WebhookVerifyResult> {
    return this.parseWebhook(req.payload, req.signature ?? "");
  }
}

/* ── 支付宝 / 微信生产通道（薄壳委托 PaymentManager · 算法零触碰）───── */

/**
 * 国内双通道生产 Provider 基座：
 * - createPayment/verifyWebhook 一对一委托 manager 同语义方法；
 * - 存量缺陷如实平移：manager 无 refund 方法（lib/payment.ts 时代经
 *   `as unknown as` 强转调用、运行时必炸且无任何调用方），本层以
 *   确定性失败替代运行时崩溃，杜绝静默 500 —— 待商户沙盒实测后按
 *   「新增外部行为」流程单独授权补真实现。
 */
abstract class ManagerBackedChannelProvider implements IPaymentProvider {
  protected readonly manager: PaymentManager;

  constructor(protected readonly channelId: "alipay" | "wechat") {
    this.manager = PaymentManager.getInstance();
  }

  get channel(): string {
    return this.channelId;
  }

  isConfigured(): boolean {
    return this.manager.isConfigured(this.channelId);
  }

  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const input = {
      orderId: req.orderId,
      amount: req.amount,
      channel: this.channelId,
      description: req.description,
      payerId: req.payerId,
      notifyUrl: `${process.env.PAYMENT_NOTIFY_URL || ""}/api/payment/notify`,
    };
    const result = (await this.manager.createPayment(input)) as {
      success: boolean;
      providerPaymentId?: string;
      payUrl?: string;
      qrCode?: string;
      tradeNo?: string;
      error?: string;
    };
    return {
      success: result.success,
      providerPaymentId: result.providerPaymentId || result.tradeNo || null,
      payUrl: result.payUrl,
      qrCode: result.qrCode,
      error: result.error,
    };
  }

  async verifyWebhook(req: WebhookVerifyRequest): Promise<WebhookVerifyResult> {
    const result = (await this.manager.handleNotify(
      this.channelId,
      req.payload as string,
      (req.headers ?? {}) as Record<string, string>,
    )) as unknown as {
      success: boolean;
      orderId?: string;
      tradeNo?: string;
      providerPaymentId?: string;
      error?: string;
    };
    return {
      success: result.success,
      orderId: result.orderId,
      tradeNo: result.tradeNo,
      providerPaymentId: result.providerPaymentId || result.tradeNo || null,
      status: result.success ? "SUCCEEDED" : "FAILED",
      error: result.error,
    };
  }

  abstract refund(req: RefundRequest): Promise<RefundResult>;
}

export class AlipayChannelProvider extends ManagerBackedChannelProvider {
  constructor() {
    super("alipay");
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    void _req;
    return { success: false, refundId: null, status: "FAILED", error: "Alipay refund not implemented" };
  }
}

export class WechatChannelProvider extends ManagerBackedChannelProvider {
  constructor() {
    super("wechat");
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    void _req;
    return { success: false, refundId: null, status: "FAILED", error: "WeChat refund not implemented" };
  }
}

/* ── 注册表 ───────────────────────────────────────────────────────── */

type RegistryKey = string; // `${channel}` 或 `${channel}@${variant}`

/** 支付通道注册表：通道可插拔的唯一装配点。 */
export class PaymentRegistry {
  private providers = new Map<RegistryKey, IPaymentProvider>();

  register(provider: IPaymentProvider, variant?: string): this {
    const key: RegistryKey = variant ? `${provider.channel}@${variant}` : provider.channel;
    this.providers.set(key, provider);
    return this;
  }

  get(channel: string, variant?: string): IPaymentProvider {
    const key: RegistryKey = variant ? `${channel}@${variant}` : channel;
    const p = this.providers.get(key);
    if (!p) throw new Error(`Unknown payment channel: ${key}`);
    return p;
  }

  has(channel: string, variant?: string): boolean {
    const key: RegistryKey = variant ? `${channel}@${variant}` : channel;
    return this.providers.has(key);
  }

  /** 已配置就绪的生产通道清单（与 PaymentManager.getAvailableChannels 语义一致）。 */
  listAvailableChannels(): string[] {
    const out: string[] = [];
    for (const [key, p] of this.providers) {
      if (key.includes("@")) continue;
      if (p.isConfigured()) out.push(p.channel);
    }
    return out;
  }
}

let registrySingleton: PaymentRegistry | null = null;

/** 全局注册表单例：预注册三生产通道 + 两沙盒演示通道（alipay/wechat@sandbox）。 */
export function getPaymentRegistry(): PaymentRegistry {
  if (!registrySingleton) {
    registrySingleton = new PaymentRegistry();
    registrySingleton
      .register(new StripeChannelProvider())
      .register(new AlipayChannelProvider())
      .register(new WechatChannelProvider())
      .register(alipayService, "sandbox")
      .register(wechatPayService, "sandbox");
  }
  return registrySingleton;
}

/** 便捷门面：创建支付（provider 缺省 stripe，与 lib/payment.ts 时代一致）。 */
export async function createPaymentVia(
  req: CreatePaymentRequest & { provider?: string },
): Promise<CreatePaymentResult> {
  return getPaymentRegistry().get(req.provider ?? "stripe").createPayment(req);
}

/**
 * 便捷门面：已配置就绪的生产通道清单（等价平移 lib/payment.ts
 * getAvailablePaymentChannels → PaymentManager.getAvailableChannels 语义）。
 * stripe 未配置密钥时不入清单（isMock），守恒原行为。
 */
export function getAvailablePaymentChannels(): string[] {
  return getPaymentRegistry().listAvailableChannels();
}