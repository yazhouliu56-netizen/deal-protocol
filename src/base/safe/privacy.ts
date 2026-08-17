/**
 * 数据全生命周期脱敏 / 遗忘权（ADR-0013，缺口 N10）。
 * 脱敏：手机号/姓名/地址/邮箱掩码 + 身份证。遗忘权：用户导出/删除请求。
 * 纯函数，SSR 安全。
 */

export type SensitiveKind = "phone" | "name" | "address" | "email" | "id";

export function mask(kind: SensitiveKind, value: string): string {
  const v = value.trim();
  if (!v) return "";
  switch (kind) {
    case "phone": {
      const d = v.replace(/\D/g, "");
      return d.length > 7 ? `${d.slice(0, 3)}****${d.slice(-4)}` : v;
    }
    case "name":
      return v.length > 1 ? `${v[0]}**` : "**";
    case "address":
      return v.length > 4 ? `${v.slice(0, 2)}****${v.slice(-2)}` : `${v[0]}**`;
    case "email": {
      const [u, dom] = v.split("@");
      if (!dom) return v;
      return `${u.slice(0, 2)}***@${dom}`;
    }
    case "id":
      return v.length > 10 ? `${v.slice(0, 3)}***********${v.slice(-4)}` : v;
  }
}

export type ForgetKind = "profile" | "wallet" | "waves" | "claims" | "reviews" | "all";

/** 遗忘权请求：登记要删除的数据域（幂等，重复请求合并）。 */
export interface ForgetRequest {
  id: string;
  userId: string;
  kind: ForgetKind;
  requestedAt: number;
  /** 处理状态：pending → anonymized（数据销毁或匿名化）。 */
  status: "pending" | "anonymized";
}

export function requestForget(
  requests: ForgetRequest[],
  userId: string,
  kind: ForgetKind,
  now: number
): { requests: ForgetRequest[]; req: ForgetRequest; fresh: boolean } {
  const dup = requests.find((r) => r.userId === userId && r.kind === kind && r.status === "pending");
  if (dup) return { requests, req: dup, fresh: false };
  const req: ForgetRequest = {
    id: `forget-${now.toString(36)}-${requests.length}`,
    userId,
    kind,
    requestedAt: now,
    status: "pending",
  };
  return { requests: [...requests, req], req, fresh: true };
}

/** 匿名化处理：对给定命名空间（对象）按遗忘域删字段。 */
export function anonymize<T extends Record<string, unknown>>(data: T, kind: ForgetKind): Partial<T> {
  const next = { ...data };
  const drop = (keys: string[]) => {
    for (const k of keys) delete next[k];
  };
  switch (kind) {
    case "profile":
      drop(["nickname", "avatar", "tags", "categories", "phone"]);
      break;
    case "wallet":
      drop(["account", "ledger", "deposits"]);
      break;
    case "waves":
      drop(["waves", "claims"]);
      break;
    case "reviews":
      drop(["reviews"]);
      break;
    case "all":
      for (const k of Object.keys(next)) delete next[k];
      break;
  }
  return next;
}

/* ═══ L4-M5 隐私全生命周期遗忘门面（P2 战役第一波攻坚，privacy-erasure 密态销毁闭环） ═══ */
export * from "./privacy-erasure.ts";