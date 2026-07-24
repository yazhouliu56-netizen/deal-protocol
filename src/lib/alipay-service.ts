import crypto from 'crypto';

export class AlipayService {
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
    } catch (e) {
      return false;
    }
  }
}

export const alipayService = new AlipayService();
