/**
 * 电子签章 + 履约保险壳（ADR-0012，缺口 N7）。
 * 签章：对协议内容快照做确定性哈希（djb2 链）作为「章」，可验签防篡改。
 * 保险：本地履约险壳——投保（扣押金）、理赔（违约 → 赔付），纯函数。
 * 真实签章/保险机构接入为外部替换点（宪法 #10：壳即降级，永不裸奔）。
 */

/** djb2 字符串哈希（与 roamGuard 同族）→ 章号。 */
export function hashDoc(content: string): string {
  let h = 5381;
  for (let i = 0; i < content.length; i++) {
    h = ((h << 5) + h + content.charCodeAt(i)) >>> 0;
  }
  return `seal-${h.toString(16).padStart(8, "0")}`;
}

export interface SignedDoc {
  content: string;
  seal: string;
  signedAt: number;
  signerId: string;
}

export function signDoc(content: string, signerId: string, now: number): SignedDoc {
  return { content, seal: hashDoc(content), signedAt: now, signerId };
}

/** 验签：内容未变 + 章匹配 → 真。 */
export function verifyDoc(doc: SignedDoc): { ok: boolean; note: string } {
  const recomputed = hashDoc(doc.content);
  if (recomputed !== doc.seal) {
    return { ok: false, note: "内容与章不匹配（疑似篡改）" };
  }
  return { ok: true, note: `有效（${doc.signerId} @ ${new Date(doc.signedAt).toLocaleString("zh-CN")}）` };
}

// ---------- 履约保险壳 ----------

export interface InsurePolicy {
  id: string;
  waveId: string;
  holderId: string;
  premium: number;
  amount: number;
  issuedAt: number;
  claimed: boolean;
}

/** 投保：缴保费，保单生效（幂等：同 wave+holder 已有保单不重复投保）。 */
export function insure(
  policies: InsurePolicy[],
  waveId: string,
  holderId: string,
  premium: number,
  amount: number,
  now: number
): { policies: InsurePolicy[]; policy: InsurePolicy | null; fresh: boolean } {
  const dup = policies.find((p) => p.waveId === waveId && p.holderId === holderId && !p.claimed);
  if (dup) return { policies, policy: dup, fresh: false };
  const policy: InsurePolicy = {
    id: `pol-${now.toString(36)}-${policies.length}`,
    waveId,
    holderId,
    premium,
    amount,
    issuedAt: now,
    claimed: false,
  };
  return { policies: [...policies, policy], policy, fresh: true };
}

/** 理赔：违约事件 → 赔付（一次性，幂等）。 */
export function claim(
  policies: InsurePolicy[],
  policyId: string,
  now: number
): { policies: InsurePolicy[]; payout: number } {
  const p = policies.find((x) => x.id === policyId);
  if (!p || p.claimed) return { policies, payout: 0 };
  return {
    policies: policies.map((x) => (x.id === policyId ? { ...x, claimed: true } : x)),
    payout: p.amount,
  };
}