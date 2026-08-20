// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";

import WorkerWorkbench, {
  evaluateWorkerQualification,
} from "@/components/oto-ui/profile/WorkerWorkbench";
import { registerDynamicAmmo } from "@/ammo/factory";
import { listAmmoPillDescriptors, resolveAmmoRequirementForText } from "@/ammo/registry";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";

/** 演示年龄定制（与工作台 DEMO_AGE_GATE 同语义）。 */
const AGE_GATE_20_30 = { ageRange: [20, 30] as [number, number] };

/** 洗车动态弹药（8D 全息最小合法配置；别名「上门洗车」供首页胶囊/订单匹配）。 */
function buildCarWashConfig(): IHolographicAmmoConfig {
  return {
    ammoId: "car-wash-v1",
    category: "CAR_WASH",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    workerRequirement: {
      requiredIdentityLevel: "REAL_NAME",
      minSafetyScore: 60,
    },
    pricingModel: { kind: "FIXED", amountYuan: 88 },
    fuzePolicy: { ...DEFAULT_FUZE_POLICY, fuzeId: "fuze-car-wash" },
    forwardHooks: [],
    theme: "default",
    formSchema: { fields: [{ key: "carModel", type: "text", required: true }] },
    aliases: ["上门洗车", "洗车"],
  };
}

async function mountWorkbench(): Promise<{
  container: HTMLElement;
  root: ReturnType<typeof createRoot>;
  unmount: () => void;
}> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<WorkerWorkbench onBack={() => {}} />);
  });
  return {
    container,
    root,
    unmount: () => {
      root.unmount();
      container.remove();
    },
  };
}

/** 提取工作台内指定弹药卡的资质判定结果。 */
function cardOf(container: HTMLElement, ammoId: string): HTMLElement | null {
  return container.querySelector(`[data-ammo="${ammoId}"]`);
}

describe("WorkerWorkbench 全弹药资质看板（注册表驱动）", () => {
  it("渲染注册表全部弹药卡（官方四枚：家政/组局/陪玩/家电维修）", async () => {
    const { container, unmount } = await mountWorkbench();
    const board = container.querySelector('[data-testid="ammo-qualification-board"]');
    expect(board).not.toBeNull();
    for (const id of [
      "housekeeping-v1",
      "meetup-social-v1",
      "companion-v1",
      "appliance-repair-v1",
    ]) {
      expect(cardOf(container, id), `应有 ${id} 资质卡`).not.toBeNull();
    }
    unmount();
  });

  it("kail（实名·82 分·无证书·未公安核验）判定矩阵准确", async () => {
    const { container, unmount } = await mountWorkbench();
    const hk = cardOf(container, "housekeeping-v1")!;
    expect(hk.getAttribute("data-qualified")).toBe("false");
    expect(hk.textContent).toContain("需资格证书 HEALTH_CERT");
    expect(hk.textContent).toContain("需公安核验通过");
    expect(cardOf(container, "meetup-social-v1")!.getAttribute("data-qualified")).toBe("true");
    expect(cardOf(container, "companion-v1")!.getAttribute("data-qualified")).toBe("true");
    const ar = cardOf(container, "appliance-repair-v1")!;
    expect(ar.getAttribute("data-qualified")).toBe("false");
    expect(ar.textContent).toContain("需资格证书 ELECTRICIAN_CERT");
    expect(ar.textContent).toContain("需资格证书 APPLIANCE_MAINTENANCE_CERT");
    unmount();
  });

  it("切换 wang（实名·91 分·健康证·已公安核验）：家政仅剩年龄定制拦截", async () => {
    const { container, unmount } = await mountWorkbench();
    const buttons = [...container.querySelectorAll('button[aria-pressed]')];
    expect(buttons.length).toBeGreaterThanOrEqual(2);
    await act(async () => {
      (buttons[1] as HTMLButtonElement).click();
    });
    const hk = cardOf(container, "housekeeping-v1")!;
    expect(hk.getAttribute("data-qualified")).toBe("false");
    expect(hk.textContent).toContain("年龄条件不匹配");
    expect(hk.textContent).not.toContain("需资格证书");
    expect(cardOf(container, "companion-v1")!.getAttribute("data-qualified")).toBe("true");
    unmount();
  });

  it("动态弹药热注后：工作台自动长出新品卡（工厂上线 → 看板自动扩展）", async () => {
    const reg = registerDynamicAmmo(buildCarWashConfig());
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const { container, unmount } = await mountWorkbench();
    const card = cardOf(container, "car-wash-v1");
    expect(card).not.toBeNull();
    expect(card!.textContent).toContain("上门洗车");
    unmount();
  });

  it("动态弹药热注后：首页胶囊描述符同步长出（单一真理源同源扩展）", () => {
    const pills = listAmmoPillDescriptors();
    const pill = pills.find((p) => p.ammoId === "car-wash-v1");
    expect(pill).toBeDefined();
    expect(pill!.label).toBe("上门洗车");
    expect(pill!.icon).toBe("⚡");
    expect(pill!.theme).toBe("default");
    expect(resolveAmmoRequirementForText("上门洗车 精护套餐")).toBeDefined();
  });
});

describe("evaluateWorkerQualification 资质审查纯函数", () => {
  it("实名等级有序判定：档案 REAL_NAME ≥ 需求 BASIC → 达标", () => {
    expect(evaluateWorkerQualification("kail", { requiredIdentityLevel: "BASIC" })).toEqual([]);
  });

  it("公安核验一票判定：需求 police 而档案未核验 → 明确缺项", () => {
    const missing = evaluateWorkerQualification("kail", { isPoliceVerified: true });
    expect(missing.some((m) => m.includes("公安核验"))).toBe(true);
    expect(evaluateWorkerQualification("wang", { isPoliceVerified: true })).toEqual([]);
  });

  it("安全分/证书/年龄定制缺项展示", () => {
    expect(evaluateWorkerQualification("kail", { minSafetyScore: 90 })).toContain(
      "需安全背调分 ≥90（当前 82）",
    );
    expect(evaluateWorkerQualification("kail", { requiredCertificates: ["HEALTH_CERT"] })).toContain(
      "需资格证书 HEALTH_CERT",
    );
    const aged = evaluateWorkerQualification(
      "wang",
      { requiredCertificates: ["HEALTH_CERT"] },
      AGE_GATE_20_30,
    );
    expect(aged.some((m) => m.includes("年龄条件不匹配"))).toBe(true);
  });

  it("订单级门槛匹配：服务文本命中注册表（保洁单 → 家政门槛 / 羽毛球 → 组局门槛）", () => {
    const hk = resolveAmmoRequirementForText("深度保洁 · 180㎡")!;
    expect(hk.requiredCertificates).toContain("HEALTH_CERT");
    expect(resolveAmmoRequirementForText("羽毛球 4 人双打")?.requiredIdentityLevel).toBe(
      "BASIC",
    );
    expect(resolveAmmoRequirementForText("日系写真 · 滨江")).toBeUndefined();
    expect(evaluateWorkerQualification("kail", hk).some((m) => m.includes("HEALTH_CERT"))).toBe(
      true,
    );
  });
});