"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  bind,
  extraLogin,
  makeDeviceId,
  roam,
  riskOf,
  type DeviceBinding,
  type RoamEvent,
  type RoamRuleParams,
} from "@/base/risk/roamGuard";
import { isRuleEnabled, riskRulesFor } from "@/ammo/risk-rule";

/** ammo/risk-rule 的 roam-guard 引信参数 → base 阈值（宪法 #5：引信跟弹药走）。 */
function roamParams(): RoamRuleParams {
  const rules = riskRulesFor("");
  const roam = rules.find((r) => r.rule === "roam-guard");
  const p = roam?.params ?? {};
  return {
    warnThreshold:
      typeof p.warnThreshold === "number" ? p.warnThreshold : 2,
    freezeThreshold:
      typeof p.freezeThreshold === "number" ? p.freezeThreshold : 3,
  };
}

/** 引信开关：roam-guard 关闭 → 永不判 high（watch 封顶，防误伤家庭共机）。 */
function roamEnabled(): boolean {
  return isRuleEnabled(riskRulesFor(""), "roam-guard");
}

/** 导出：组件侧 riskOf 显示与 store 判定共用同一套引信参数。 */
export { roamParams };

type RoamState = {
  /** 本设备指纹（localStorage 持久化，同设备跨会话稳定）。 */
  deviceId: string;
  bindings: DeviceBinding[];
  events: RoamEvent[];
  /** 确保当前身份在本设备已登记（幂等），并返回当前风险。 */
  ensureBinding: (identityId: string) => { level: string; count: number };
  /** 模拟换新设备登录同一身份（漫游）。 */
  roamDemo: (identityId: string) => void;
  /** 模拟同设备注册第二个身份（触发风控）。 */
  simulateMultiOpen: (identityId: string) => void;
  /** 清空演示痕迹，回到初始单身份。 */
  resetDemo: (identityId: string) => void;
};

/** 设备指纹：UA + 随机盐（盐首次生成后持久化 → 同设备跨会话稳定）。 */
function initialDeviceId(storage?: Storage): string {
  try {
    const seed =
      storage?.getItem("roam-seed") ??
      (() => {
        const s = Math.random().toString(36).slice(2, 10);
        storage?.setItem("roam-seed", s);
        return s;
      })();
    return makeDeviceId(
      storage ? "oto-client-webgl" : "oto-client-ssr",
      seed
    );
  } catch {
    return makeDeviceId("oto-client-fallback", "anon");
  }
}

const now = () => Date.now();

export const useRoamStore = create<RoamState>()(
  persist(
    (set, get) => ({
      deviceId: initialDeviceId(),
      bindings: [],
      events: [],
      ensureBinding: (identityId) => {
        const s = get();
        const { bindings, fresh } = bind(
          s.bindings,
          s.deviceId,
          identityId,
          now()
        );
        if (fresh || bindings.length !== s.bindings.length) {
          set({
            bindings,
            events: [
              ...s.events,
              { at: now(), kind: "login", note: `身份 ${identityId} 登录本设备` },
            ],
          });
        }
        const r = riskOf(get().bindings, s.deviceId, roamParams());
        return roamEnabled()
          ? { level: r.risk, count: r.count }
          : { level: r.risk === "high" ? "watch" : r.risk, count: r.count };
      },
      roamDemo: (identityId) => {
        const s = get();
        const other = makeDeviceId("simulated-device", String(now()));
        const out = roam(s.bindings, s.deviceId, other, identityId, now());
        set({ bindings: out.bindings, events: [out.event, ...s.events] });
      },
      simulateMultiOpen: (identityId) => {
        const s = get();
        // 同一设备已有 N 个身份 → 追加第 N+1 个模拟身份（连点 → 升至 high）
        const n = s.bindings.filter((b) => b.deviceId === s.deviceId).length + 1;
        const altId = `${identityId}-alt${n}`;
        const out = extraLogin(s.bindings, s.deviceId, altId, now(), roamParams());
        set({
          bindings: out.bindings,
          events: [out.event, ...s.events],
        });
      },
      resetDemo: (identityId) => {
        const s = get();
        set({
          bindings: [],
          events: [
            { at: now(), kind: "reset", note: "演示状态已重置（回到单设备单身份）" },
            ...s.events,
          ],
        });
        get().ensureBinding(identityId);
      },
    }),
    {
      name: "oto-roam-v1",
      partialize: (s) => ({ deviceId: s.deviceId, bindings: s.bindings, events: s.events }),
    }
  )
);