/**
 * 通信外漏识别与脱敏（P3.1-1 防跳单 · Anti-Disintermediation）。
 *
 * 纯确定性函数（宪法 #1 底座优先 · 红线 3 单向依赖）：0 I/O、0 DOM、0 外部模型，
 * 输入文本 → 高置信正则识别 → 原地脱敏输出。
 *
 * 策略 = 遮蔽 + 警示（严禁阻断交易）：命中仅替换展示文本，五态状态机 0 改动。
 * v1 高置信规则（拒绝 NLP 过度工程）：
 *   - PHONE  中国大陆 11 位（锚定 1[3-9] 前缀，允许空格/短横线分隔）→ 138****5678
 *   - WECHAT 高频前缀（vx/wx/v信/微信/威信/薇信/加微）+ 6~20 位 ID → [微信号已脱敏]
 *   - QQ     强制携带前缀（qq/扣扣/企鹅）+ 5~11 位数字（裸数字不命中）→ [QQ号已脱敏]
 *   - EMAIL  标准邮箱 → a***@domain.com
 *   - URL    http(s):// 或 www. → [外部链接已拦截]
 * 防误杀：标准日期（2026-08-28）、金额（100元）、长编号（10000000001）100% 放行。
 * 降级（宪法 #10）：畸形输入 0ms 返回原文，绝不抛异常。
 */

export type ContactLeakType = "PHONE" | "WECHAT" | "QQ" | "EMAIL" | "URL";

export interface IContactLeakResult {
  hasLeak: boolean;
  originalText: string;
  maskedText: string;
  leakTypes: ContactLeakType[];
  matchedPatterns: string[];
}

const PHONE_RE = /(?<!\d)1[3-9]\d[-\s]?\d{4}[-\s]?\d{4}(?!\d)/g;
const WECHAT_RE =
  /(?<![a-zA-Z0-9])(?:vx|wx|v信|微信|威信|薇信|加微)\s*[号是]?\s*[:：]?\s*[a-zA-Z0-9][a-zA-Z0-9_-]{5,19}/gi;
const QQ_RE =
  /(?<![a-zA-Z0-9])(?:qq|扣扣|企鹅)\s*[号是]?\s*[:：]?\s*(?<!\d)[1-9]\d{4,10}(?!\d)/gi;
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const URL_RE = /(?:https?:\/\/|www\.)[^\s]+/gi;

function maskPhone(m: string): string {
  const digits = m.replace(/\D/g, "");
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

function maskEmail(m: string): string {
  const at = m.indexOf("@");
  return at > 0 ? `${m[0]}***${m.slice(at)}` : "[邮箱已脱敏]";
}

/** 识别并返回完整结果（类型清单 + 脱敏文本）。matchedPatterns 仅含脱敏形态（条文 #8 不留明文）。 */
export function detectContactLeaks(text: string): IContactLeakResult {
  const original = typeof text === "string" ? text : "";
  const leakTypes: ContactLeakType[] = [];
  const matchedPatterns: string[] = [];
  let masked = original;
  if (original) {
    try {
      const rules: Array<[ContactLeakType, RegExp, (m: string) => string]> = [
        ["URL", URL_RE, () => "[外部链接已拦截]"],
        ["EMAIL", EMAIL_RE, maskEmail],
        ["PHONE", PHONE_RE, maskPhone],
        ["WECHAT", WECHAT_RE, () => "[微信号已脱敏]"],
        ["QQ", QQ_RE, () => "[QQ号已脱敏]"],
      ];
      for (const [type, re, mask] of rules) {
        // 每次调用克隆正则（g 标志 lastIndex 状态隔离，纯函数无跨调用副作用）
        const rx = new RegExp(re.source, re.flags);
        masked = masked.replace(rx, (m) => {
          const maskedForm = mask(m);
          if (!leakTypes.includes(type)) leakTypes.push(type);
          matchedPatterns.push(`${type}→${maskedForm}`);
          return maskedForm;
        });
      }
    } catch {
      return {
        hasLeak: false,
        originalText: original,
        maskedText: original,
        leakTypes: [],
        matchedPatterns: [],
      };
    }
  }
  return {
    hasLeak: leakTypes.length > 0,
    originalText: original,
    maskedText: masked,
    leakTypes,
    matchedPatterns,
  };
}

/** 接线便捷入口：仅需脱敏文本时使用（原地替换，不阻断）。 */
export function maskContactLeaks(text: string): string {
  return detectContactLeaks(text).maskedText;
}
