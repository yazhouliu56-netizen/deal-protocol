import crypto from 'crypto';
import type {
  CreatePaymentRequest,
  CreatePaymentResult,
  IPaymentProvider,
  RefundRequest,
  RefundResult,
  WebhookVerifyRequest,
  WebhookVerifyResult,
} from './registry';

/**
 * 支付宝沙盒演示通道（P1-5 收编平移 · 自 src/lib/alipay-service.ts 原位迁移）：
 * 无签名 URL 生成 + 占位密钥 Mock 降级 + 宽松验签——算法与降级语义逐字守恒，
 * 仅外挂 IPaymentProvider 统一契约壳以注册进 PaymentRegistry。
 */
export class AlipayService implements IPaymentProvider {
  readonly channel = 'alipay';

  private appId: string;
  private privateKey: string;
  private alipayPublicKey: string;
  private gateway: string;

  constructor() {
    this.appId = process.env.ALIPAY_APP_ID || '';
    this.privateKey = process.env.ALIPAY_PRIVATE_KEY || '';
    this.alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || '';
    this.gateway = process.env.ALIPAY_GATEWAY || 'https://openapi-sandbox.dl.alipaydev.com/gateway.do';
  }

  isConfigured(): boolean {
    return Boolean(this.appId) && !this.appId.includes('2021000000000000');
  }

  /** 统一契约适配：内部委托既有 generatePaymentUrl（算法零触碰）。 */
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const payUrl = this.generatePaymentUrl({
      outTradeNo: req.orderId,
      amount: req.amount,
      subject: req.description,
    });
    if (payUrl.includes('mock_channel=alipay')) {
      return { success: true, status: 'SUCCEEDED', payUrl, providerPaymentId: `ali_mock_${req.orderId}` };
    }
    return { success: true, status: 'PENDING', payUrl };
  }

  /** 统一契约适配：委托既有 verifySignature（宽松验签 + 占位放行守恒）。 */
  async verifyWebhook(req: WebhookVerifyRequest): Promise<WebhookVerifyResult> {
    const params = req.params ?? {};
    const ok = this.verifySignature(params);
    return ok
      ? { success: true, orderId: params.out_trade_no ?? '', tradeNo: params.trade_no ?? '', status: 'SUCCEEDED' }
      : { success: false, error: 'Alipay sandbox signature verification failed' };
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    void _req;
    return { success: false, refundId: null, status: 'FAILED', error: 'Alipay sandbox refund not supported' };
  }

  public generatePaymentUrl(params: { outTradeNo: string; amount: number; subject: string; returnUrl?: string; notifyUrl?: string }) {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const notifyUrl = params.notifyUrl || `${siteUrl}/api/webhooks/alipay`;
    const returnUrl = params.returnUrl || `${siteUrl}/payment/${params.outTradeNo}?status=success`;

    const bizContent = JSON.stringify({
      out_trade_no: params.outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: params.amount.toFixed(2),
      subject: params.subject,
    });

    if (!this.appId || this.appId.includes('2021000000000000')) {
      return `${returnUrl}&mock_channel=alipay&amount=${params.amount}`;
    }

    return `${this.gateway}?app_id=${this.appId}&biz_content=${encodeURIComponent(bizContent)}&notify_url=${encodeURIComponent(notifyUrl)}`;
  }

  public verifySignature(params: Record<string, string>): boolean {
    if (!this.alipayPublicKey || this.alipayPublicKey.includes('your_alipay')) {
      return true;
    }
    try {
      const sign = params.sign;
      if (!sign) return false;
      const sortedKeys = Object.keys(params).filter(k => k !== 'sign' && k !== 'sign_type').sort();
      const content = sortedKeys.map(k => `${k}=${params[k]}`).join('&');

      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(content, 'utf8');
      return verify.verify(this.alipayPublicKey, sign, 'base64');
    } catch {
      return false;
    }
  }
}

export const alipayService = new AlipayService();
