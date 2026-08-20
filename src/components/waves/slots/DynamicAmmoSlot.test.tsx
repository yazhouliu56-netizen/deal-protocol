// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import DynamicAmmoSlot, {
  describeBizParamRows,
  paramIconOf,
} from "@/components/waves/slots/DynamicAmmoSlot";
import { DEFAULT_FUZE_POLICY } from "@/types/fuze-policy";
import type { IAmmoDefinition } from "@/types/ammo-schema";

const AMMO: IAmmoDefinition = {
  ammoId: "drone-crop-spray-v1",
  category: "DRONE_CROP_SPRAY",
  version: "1.0.0",
  fiveStateHooks: [],
  pricingModel: { kind: "FIXED", amountYuan: 500 },
  fuzePolicy: DEFAULT_FUZE_POLICY,
  dispatchRule: undefined as never,
  sop: {},
  holographic: {
    ammoId: "drone-crop-spray-v1",
    category: "DRONE_CROP_SPRAY",
    version: "1.0.0",
    supplyCluster: "C1_MOBILITY",
    pricingModel: { kind: "FIXED", amountYuan: 500 },
    fuzePolicy: DEFAULT_FUZE_POLICY,
    forwardHooks: [],
    theme: "default",
    formSchema: { fields: [{ key: "fieldAreaMu", type: "number", required: true }] },
  },
};

describe("DynamicAmmoSlot 毛玻璃参数胶囊 + 拟物图标", () => {
  it("bizParams 每行渲染毛玻璃胶囊（图标 chip + 键 + 值）", () => {
    const html = renderToStaticMarkup(
      <DynamicAmmoSlot
        ammo={AMMO}
        bizParams={{ fieldAreaMu: 50, pesticideType: "除草剂", serialNo: "SN-001" }}
      />,
    );
    expect(html).toContain('data-param="fieldAreaMu"');
    expect(html).toContain('data-param-icon');
    expect(html).toContain('class="dyn-param');
    expect(html).toContain(">50<");
    expect(html).toContain("除草剂");
    expect(html).toContain("SN-001");
  });

  it("空参数快照：空态占位胶囊（不白屏）", () => {
    const html = renderToStaticMarkup(<DynamicAmmoSlot ammo={AMMO} />);
    expect(html).toContain('data-empty-params');
    expect(html).toContain("未固化");
  });
});

describe("paramIconOf 拟物图标规则", () => {
  it("键名子串命中（大小写不敏感）→ 拟物图标", () => {
    expect(paramIconOf("fieldAreaMu")).toBe("🌾");
    expect(paramIconOf("pesticideType")).toBe("🧪");
    expect(paramIconOf("CROP_KIND")).toBe("🌱");
    expect(paramIconOf("carModel")).toBe("🔧");
    expect(paramIconOf("droneAltitudeM")).toBe("🚁");
    expect(paramIconOf("waterVolumeL")).toBe("💧");
    expect(paramIconOf("startTime")).toBe("⏰");
    expect(paramIconOf("address")).toBe("📍");
    expect(paramIconOf("amountYuan")).toBe("💰");
  });

  it("无规则键 → ⚙️ 兜底", () => {
    expect(paramIconOf("randomParamXyz")).toBe("⚙️");
  });
});

describe("describeBizParamRows 快照序列化", () => {
  it("标量直显 / null 占位 / 对象 JSON 序列化", () => {
    const rows = describeBizParamRows({ a: 1, b: null, c: { x: 1 } });
    expect(rows).toEqual([
      { key: "a", display: "1" },
      { key: "b", display: "—" },
      { key: "c", display: '{"x":1}' },
    ]);
    expect(describeBizParamRows(undefined)).toEqual([]);
  });
});