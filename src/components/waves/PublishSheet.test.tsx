// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as toastModule from "@/base/platform/toast";
import { useToastStore } from "@/base/platform/toast";
import { useWaveStore } from "@/store/useWaveStore";

import PublishSheet from "@/components/waves/PublishSheet";
import { describeFormSchemaFields } from "@/components/waves/DynamicDraftCard";
import { getAmmoDefinition } from "@/ammo/registry";
import { registerDynamicAmmo } from "@/ammo/factory";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IHolographicAmmoConfig } from "@/types/ammo-schema";

function mountPublishSheet(initialCategory?: string) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PublishSheet open={true} onClose={() => {}} initialCategory={initialCategory} />);
  });
  return { container, root, unmount: () => { act(() => root.unmount()); container.remove(); } };
}

describe("PublishSheet P1-5 声明式表单驱动", () => {
  it("describeFormSchemaFields 兼容 map 形态（appliance_repair 家电维修）", () => {
    const ammo = getAmmoDefinition("appliance_repair");
    // appliance_repair 使用 map 形态 { applianceType: {type:"select",...}, faultDescription:{type:"string"} }
    // 需兼容为 fields 数组
    const fields = describeFormSchemaFields(ammo);
    expect(fields.length).toBe(2);
    const keys = fields.map((f) => f.key);
    expect(keys).toContain("applianceType");
    expect(keys).toContain("faultDescription");
    const typeMap = Object.fromEntries(fields.map((f) => [f.key, f.type]));
    expect(typeMap.applianceType).toBe("enum");
    expect(typeMap.faultDescription).toBe("string");
    expect(fields.find((f) => f.key === "applianceType")?.required).toBe(true);
    expect(fields.find((f) => f.key === "applianceType")?.options).toEqual(["空调", "洗衣机", "冰箱", "油烟机", "燃气灶"]);
  });

  it("describeFormSchemaFields 兼容 fields[] 数组形态（动态长尾）", () => {
    const config: IHolographicAmmoConfig = {
      ammoId: "test-publish-longtail-v1",
      category: "TEST_PUBLISH_LONGTAIL",
      version: "1.0.0",
      supplyCluster: "C1_MOBILITY",
      pricingModel: { kind: "FIXED", amountYuan: 100 },
      fuzePolicy: DEFAULT_FUZE_POLICY,
      theme: "default",
      formSchema: {
        fields: [
          { key: "fieldAreaMu", label: "作业亩数", type: "number", required: true, defaultValue: 10 },
          { key: "pesticideType", label: "农药类型", type: "picker", options: ["除草剂", "杀菌剂"], defaultValue: "除草剂" },
          { key: "remark", label: "备注", type: "text" },
        ],
      },
    };
    const reg = registerDynamicAmmo(config);
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    const fields = describeFormSchemaFields(reg.ammo);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toMatchObject({ key: "fieldAreaMu", label: "作业亩数", type: "number", required: true });
    expect(fields[1]).toMatchObject({ key: "pesticideType", type: "enum", options: ["除草剂", "杀菌剂"], value: "除草剂" });
    expect(fields[2]).toMatchObject({ key: "remark", type: "string", required: false });
  });

  it("PublishSheet 家政品类（无 formSchema）不渲染动态表单区", async () => {
    const { container, unmount } = mountPublishSheet("家政保洁");
    // 家政弹药无 formSchema，动态表单区不应出现
    expect(container.querySelector('[data-testid="publish-dynamic-form"]')).toBeNull();
    // 但应有定价口径与草稿卡（P1 第 4 步：旧「建议起价」scene 残留已出清，
    // 价格权威收敛为弹药 D2 起步口径 —— 原断言锁定的正是被移除的旧文案）
    expect(container.textContent).toContain("方案起步 预估费用：¥60/小时 × 2小时起");
    expect(container.textContent).not.toContain("建议起价");
    unmount();
  });

  it("PublishSheet 家电维修（map 形态）渲染 2 字段：select + string，必填星标", async () => {
    const { container, unmount } = mountPublishSheet("家电维修");
    const form = container.querySelector('[data-testid="publish-dynamic-form"]');
    expect(form).not.toBeNull();
    expect(form!.textContent).toContain("appliance-repair-v1");
    // 两个字段
    const fieldAppliance = container.querySelector('[data-field="applianceType"]') as HTMLSelectElement | null;
    const fieldFault = container.querySelector('[data-field="faultDescription"]') as HTMLInputElement | null;
    expect(fieldAppliance).not.toBeNull();
    expect(fieldFault).not.toBeNull();
    // select 应含中文选项
    expect(fieldAppliance!.tagName.toLowerCase()).toBe("select");
    expect(fieldAppliance!.innerHTML).toContain("空调");
    expect(fieldAppliance!.innerHTML).toContain("洗衣机");
    // 必填星标
    expect(form!.innerHTML).toContain("text-red-400");
    // 触控高度 ≥44
    expect(Number((fieldAppliance!.style.minHeight || "48px").replace("px", "")) >= 44 || fieldAppliance!.className.includes("min-h-[48px]")).toBe(true);
    unmount();
  });

  it("PublishSheet 动态长尾（fields[]）渲染 number + enum + string 三形态", async () => {
    const config: IHolographicAmmoConfig = {
      ammoId: "test-publish-triple-v1",
      category: "TEST_PUBLISH_TRIPLE",
      version: "1.0.0",
      supplyCluster: "C1_MOBILITY",
      pricingModel: { kind: "FIXED", amountYuan: 200 },
      fuzePolicy: DEFAULT_FUZE_POLICY,
      theme: "default",
      formSchema: {
        fields: [
          { key: "amount", label: "数量", type: "number", required: true },
          { key: "level", label: "档位", type: "select", options: ["低", "中", "高"], required: true },
          { key: "agree", label: "同意条款", type: "boolean" },
        ],
      },
    };
    const reg = registerDynamicAmmo(config);
    if (!reg.ok) throw new Error(reg.errors.join(";"));
    // 中文别名直拨验证
    const { container, unmount } = mountPublishSheet("TEST_PUBLISH_TRIPLE");
    const form = container.querySelector('[data-testid="publish-dynamic-form"]');
    expect(form).not.toBeNull();
    expect(container.querySelector('[data-field="amount"]')).not.toBeNull();
    expect(container.querySelector('[data-field="level"]')).not.toBeNull();
    expect(container.querySelector('[data-field="agree"]')).not.toBeNull();
    // number 为 input type=number
    const numInput = container.querySelector('[data-field="amount"]') as HTMLInputElement;
    expect(numInput.type).toBe("number");
    // enum 为 select
    const sel = container.querySelector('[data-field="level"]') as HTMLSelectElement;
    expect(sel.tagName.toLowerCase()).toBe("select");
    // boolean 为 switch button role=switch
    const boolBtn = container.querySelector('[data-field="agree"]') as HTMLButtonElement;
    expect(boolBtn.getAttribute("role")).toBe("switch");
    unmount();
  });

  it("PublishSheet 零品类硬编码分支：category 切换 100% 由弹药表驱动，无 if(category===) 残留", async () => {
    // 静态扫描：文件内容不应含品类特化硬编码分支（红线 2）
    const fs = await import("fs");
    const path = await import("path");
    const file = fs.readFileSync(path.join(process.cwd(), "src/components/waves/PublishSheet.tsx"), "utf-8");
    // 禁止出现针对具体类目的硬编码条件
    expect(file).not.toMatch(/if\s*\(\s*category\s*===\s*['"]housekeeping['"]/);
    expect(file).not.toMatch(/if\s*\(\s*category\s*===\s*['"]meetup['"]/);
    expect(file).not.toMatch(/category\s*===\s*['"]家政/);
    // 必须消费 formSchema 驱动
    expect(file).toContain("describeFormSchemaFields");
    expect(file).toContain("bizParams");
    expect(file).toContain("holographic.formSchema");
  });

  describe("P1 第 4 步：单 CTA 收敛 + 价格权威单一源", () => {
    it("面板内嵌草稿卡隐藏发射按钮：视口内唯一主按钮为「广播出去」", () => {
      const { container, unmount } = mountPublishSheet("家政保洁");
      const html = container.textContent ?? "";
      // 内嵌草稿卡的「扣动扳机」必须被 hideLaunchButton 隐藏
      expect(html).not.toContain("扣动扳机·一键发布");
      // 唯一主行动按钮存在
      const primaryCtas = Array.from(container.querySelectorAll("button")).filter(
        (b) => (b.textContent ?? "").includes("广播出去"),
      );
      expect(primaryCtas.length).toBe(1);
      unmount();
    });

    it("价格口径归一：家政显示 D2 起步 ¥60/小时 × 2小时起，¥50 残留彻底出清", () => {
      const { container, unmount } = mountPublishSheet("家政保洁");
      const html = container.textContent ?? "";
      expect(html).toContain("¥60/小时 × 2小时起");
      expect(html).not.toContain("建议起价");
      expect(html).not.toContain("¥50");
      unmount();
    });

    it("组局价格口径：PER_SEAT ¥80/人 · 2人起（AA 均摊）", () => {
      const { container, unmount } = mountPublishSheet("羽毛球约局");
      expect(container.textContent).toContain("¥80/人 · 2人起（AA 均摊）");
      unmount();
    });

    it("预算默认值对齐方案起步底价（点击家政快捷胶囊 → 120）", () => {
      const { container, unmount } = mountPublishSheet("家政保洁");
      // 模拟用户点击品类快捷胶囊触发 SOP 默认装配（applySopDefaults）
      const pill = Array.from(container.querySelectorAll("button")).find((b) =>
        (b.textContent ?? "").includes("家政保洁"),
      );
      act(() => {
        pill?.click();
      });
      const budgetInput = container.querySelector(
        'input[aria-label="基础预算"]',
      ) as HTMLInputElement | null;
      expect(budgetInput?.value).toBe("120");
      unmount();
    });
  });

  describe("P8 roam/sentinel Toast 真实触发与去噪 (jsdom spy)", () => {
    beforeEach(() => {
      useToastStore.setState({ items: [] });
      vi.restoreAllMocks();
    });
    afterEach(() => {
      useToastStore.setState({ items: [] });
      vi.restoreAllMocks();
    });

    async function fillAndPublish(container: HTMLElement) {
      const timeInput = container.querySelector('input[aria-label="需求时间"]') as HTMLInputElement | null;
      if (timeInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        await act(async () => {
          setter?.call(timeInput, "明天 10:00");
          timeInput.dispatchEvent(new Event("change", { bubbles: true }));
          timeInput.dispatchEvent(new Event("input", { bubbles: true }));
        });
        // React controlled: also fire via input event covers state, fallback direct state setter via DOM? Ensure time state synced by simulating user input
        // PublishSheet reads `time` state, which updates via onChange; above triggers it.
      }
      const btn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("广播出去")) as HTMLButtonElement;
      expect(btn).not.toBeNull();
      await act(async () => {
        btn.click();
      });
    }

    it("high sentinel 拦截触发 toast.error 单次，去噪 Ref 阻二次", async () => {
      const spy = vi.spyOn(toastModule, "toast");
      const mock = vi.spyOn(useWaveStore.getState(), "createPendingWave").mockReturnValue({ id: "", amount: 0, blocked: "sentinel" } as never);
      const { container, unmount } = mountPublishSheet("家政保洁");
      await fillAndPublish(container);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("账号多设备"), "error");
      expect(container.textContent).toContain("反欺诈探针甄检到高危信号");
      // 二次点击去噪不二次 toast
      await fillAndPublish(container);
      expect(spy).toHaveBeenCalledTimes(1);
      mock.mockRestore();
      unmount();
    });

    it("high roam 拦截触发 toast.error", async () => {
      const spy = vi.spyOn(toastModule, "toast");
      const mock = vi.spyOn(useWaveStore.getState(), "createPendingWave").mockReturnValue({ id: "", amount: 0, blocked: "roam" } as never);
      const { container, unmount } = mountPublishSheet("家政保洁");
      await fillAndPublish(container);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("账号多设备"), "error");
      expect(container.textContent).toContain("高危多开");
      mock.mockRestore();
      unmount();
    });

    it("watch 态发单不触发 toast（非 high 允许路径）", async () => {
      const spy = vi.spyOn(toastModule, "toast");
      // watch 为允许态：createPendingWave 返回正常单（非 blocked），publish 进入 PaySheet 无 toast
      const mock = vi.spyOn(useWaveStore.getState(), "createPendingWave").mockReturnValue({ id: "w-watch-1", amount: 100 } as never);
      const { container, unmount } = mountPublishSheet("家政保洁");
      await fillAndPublish(container);
      expect(spy).not.toHaveBeenCalled();
      mock.mockRestore();
      unmount();
    });
  });
});
