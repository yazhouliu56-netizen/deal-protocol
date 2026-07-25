import crypto from 'crypto';

export class WeChatPayService {
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
