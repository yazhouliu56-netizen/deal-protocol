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
 * 微信支付沙盒通道（P1-5 收编平移 · 自 src/lib/wechat-pay-service.ts 原位迁移）：
 * MD5 V2 签名 / JSAPI 参数包 / OAuth 登录 URL——算法与占位降级语义逐字守恒，
 * 仅外挂 IPaymentProvider 统一契约壳以注册进 PaymentRegistry。
 */
export class WeChatPayService implements IPaymentProvider {
  readonly channel = 'wechat';

  private appId: string;
  private appSecret: string;
  private mchId: string;
  private apiKey: string;

  constructor() {
    this.appId = process.env.WECHAT_APP_ID || 'wx_placeholder';
    this.appSecret = process.env.WECHAT_APP_SECRET || 'secret_placeholder';
    this.mchId = process.env.WECHAT_MCH_ID || 'mch_placeholder';
    this.apiKey = process.env.WECHAT_PAY_API_KEY || 'key_placeholder';
  }

  isConfigured(): boolean {
    return !this.appId.includes('placeholder');
  }

  /**
   * 统一契约适配：委托既有 generateJsapiPayParams（MD5 算法零触碰）。
   * JSAPI 签名参数包经 extra 承载；prepayId 由调用方生成（沙盒演示链路
   * 现状：`mock_${uuid}`，守恒）。
   */
  async createPayment(req: CreatePaymentRequest): Promise<CreatePaymentResult> {
    const prepayId = req.metadata?.prepayId ?? `mock_${req.orderId}`;
    const jsapiParams = this.generateJsapiPayParams(prepayId);
    return { success: true, status: 'PENDING', providerPaymentId: prepayId, extra: { jsapiParams } };
  }

  /** 统一契约适配：委托既有 verifySignature（MD5 + 占位放行守恒）。 */
  async verifyWebhook(req: WebhookVerifyRequest): Promise<WebhookVerifyResult> {
    const params = req.params ?? {};
    const ok = this.verifySignature(params);
    return ok
      ? { success: true, orderId: params.out_trade_no ?? '', tradeNo: params.transaction_id ?? '', status: 'SUCCEEDED' }
      : { success: false, error: 'WeChat sandbox signature verification failed' };
  }

  async refund(_req: RefundRequest): Promise<RefundResult> {
    void _req;
    return { success: false, refundId: null, status: 'FAILED', error: 'WeChat sandbox refund not supported' };
  }

  public generateOAuthUrl(redirectUri: string, scope: 'snsapi_base' | 'snsapi_userinfo' = 'snsapi_userinfo'): string {
    const encodedUri = encodeURIComponent(redirectUri);
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${this.appId}&redirect_uri=${encodedUri}&response_type=code&scope=${scope}&state=STATE#wechat_redirect`;
  }

  public generateJsapiPayParams(prepayId: string) {
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomBytes(16).toString('hex');
    const packageStr = `prepay_id=${prepayId}`;

    const rawSignStr = `appId=${this.appId}&nonceStr=${nonceStr}&package=${packageStr}&signType=MD5&timeStamp=${timeStamp}&key=${this.apiKey}`;
    const paySign = crypto.createHash('md5').update(rawSignStr).digest('hex').toUpperCase();

    return {
      appId: this.appId,
      timeStamp,
      nonceStr,
      package: packageStr,
      signType: 'MD5' as const,
      paySign,
    };
  }

  public verifySignature(params: Record<string, string>): boolean {
    if (this.appId.includes('placeholder')) return true;
    const sign = params.sign;
    if (!sign) return false;

    const sortedKeys = Object.keys(params).filter((k) => k !== 'sign').sort();
    const stringA = sortedKeys.map((k) => `${k}=${params[k]}`).join('&');
    const stringSignTemp = `${stringA}&key=${this.apiKey}`;
    const calculatedSign = crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();

    return calculatedSign === sign;
  }
}

export const wechatPayService = new WeChatPayService();
