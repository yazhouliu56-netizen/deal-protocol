/**
 * guest +1 携伴（Meetup 吸收项 ⑤）
 *
 * 开放局拼位者可携带 1 位同伴入场：携伴者须实名登记（称呼 + 出生年 + 联系方式），
 * 未成年人分级对齐 ageGate（<14 需监护人同意，儿童仅陪同不可参与资金），
 * 联系方式全生命周期脱敏（宪法 #8：隐私是血液规则）。
 * 纯函数：无 IO，时间注入，SSR/测试安全。
 */

import type { Claim } from "./wave";

/** 携伴者登记信息（姓名与联系方式仅脱敏展示）。 */
export interface GuestInfo {
  /** 携伴者称呼/姓名（脱敏展示）。 */
  name: string;
  /** 出生年（ageGate 合规：<14 需监护人同意；儿童仅陪同）。 */
  birthYear?: number;
  /** <14 岁携伴者须监护人同意（未保法 §72）。 */
  guardianConsent?: boolean;
  /** 联系方式（仅掩码展示 138****0001）。 */
  phone?: string;
  /** 登记时间。 */
  at: number;
}

/** 每个座位最多可登记 1 位携伴（Meetup +1）。 */
export const MAX_GUESTS_PER_SEAT = 1;

/** 手机号脱敏：138****0001（不足 7 位直接全掩）。 */
export function maskPhone(phone?: string): string {
  if (!phone || phone.length < 7) return phone ?? "";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export type GuestAddResult =
  | { ok: true; claim: Claim }
  | { ok: false; error: string };

/**
 * 登记携伴（幂等上限 1 人/座）。
 * 结构校验：claim 须已锁定（accepted/joined）+ 名称必填 + 未超上限。
 * 年龄合规（<14 需监护人同意）由 store 层 ageGate 校验（保持 base 纯函数零运行时依赖）。
 */
export function addGuest(
  claim: Claim,
  guest: Omit<GuestInfo, "at">,
  now = Date.now()
): GuestAddResult {
  if (claim.status !== "accepted" && claim.status !== "joined") {
    return { ok: false, error: "claim.not-locked" };
  }
  if ((claim.guests ?? []).length >= MAX_GUESTS_PER_SEAT) {
    return { ok: false, error: "guest.limit-reached" };
  }
  const name = (guest.name ?? "").trim();
  if (!name) {
    return { ok: false, error: "guest.name-required" };
  }
  return {
    ok: true,
    claim: {
      ...claim,
      guests: [...(claim.guests ?? []), { ...guest, name, at: now }],
    },
  };
}

/** 移除携伴（按序号，幂等）。 */
export function removeGuest(claim: Claim, guestIdx: number): Claim {
  const guests = claim.guests ?? [];
  if (guestIdx < 0 || guestIdx >= guests.length) return claim;
  return {
    ...claim,
    guests: guests.filter((_, i) => i !== guestIdx),
  };
}

/** 携伴列表（脱敏展示视图：电话掩码）。 */
export function visibleGuests(claim: Claim): Array<GuestInfo & { phoneMask?: string }> {
  return (claim.guests ?? []).map((g) => ({
    ...g,
    phoneMask: g.phone ? maskPhone(g.phone) : undefined,
  }));
}
