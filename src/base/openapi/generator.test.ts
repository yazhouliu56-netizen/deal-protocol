import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildOpenApiDoc, normalizeFormSchemaToJsonSchema } from "./generator.ts";
import type { IAmmoDefinition } from "../../types/ammo-schema.ts";

// 辅助：构造最小可用弹药（缺省即合法）
function mkAmmo(overrides: Partial<IAmmoDefinition> & { ammoId: string; category: string }): IAmmoDefinition {
  return {
    version: "1.0.0",
    fiveStateHooks: [],
    pricingModel: { kind: "FIXED", amountYuan: 100 },
    fuzePolicy: { fuzeId: "test-fuze", fuzeTypes: ["IMPACT"] } as never,
    supplyCluster: "C1_MOBILITY",
    holographic: {
      ammoId: overrides.ammoId,
      category: overrides.category,
      version: "1.0.0",
      supplyCluster: "C1_MOBILITY",
      pricingModel: { kind: "FIXED", amountYuan: 100 },
      fuzePolicy: { fuzeId: "test-fuze", fuzeTypes: ["IMPACT"] } as never,
      theme: "default",
      aliases: [],
    } as never,
    ...overrides,
  } as IAmmoDefinition;
}

describe("base/openapi — normalizeFormSchemaToJsonSchema 双形态归一化", () => {
  it("形态 B 对象映射：appliance-repair 双字段 select/string → JSON Schema", () => {
    const formSchema = {
      applianceType: { type: "select", options: ["空调", "洗衣机"], required: true },
      faultDescription: { type: "string", required: true },
    };
    const out = normalizeFormSchemaToJsonSchema(formSchema) as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
    assert.equal(out.type, "object");
    assert.deepEqual((out.properties.applianceType as { enum: string[] }).enum, ["空调", "洗衣机"]);
    assert.equal((out.properties.faultDescription as { type: string }).type, "string");
    assert.deepEqual([...out.required].sort(), ["applianceType", "faultDescription"]);
  });

  it("形态 A fields[] 数组：解析 key/type/options/required", () => {
    const formSchema = {
      fields: [
        { key: "petType", type: "select", options: ["dog", "cat"], required: true },
        { key: "petAgeWeight", type: "string", required: false },
      ],
    };
    const out = normalizeFormSchemaToJsonSchema(formSchema) as {
      type: string;
      properties: Record<string, unknown>;
      required?: string[];
    };
    assert.equal(out.type, "object");
    assert.ok(out.properties.petType);
    assert.ok(out.properties.petAgeWeight);
    assert.deepEqual(out.required, ["petType"]);
  });

  it("非法 type 保底 string（x- 异常隔离）", () => {
    const formSchema = {
      badField: { type: "custom-widget-xyz", required: true },
    };
    const out = normalizeFormSchemaToJsonSchema(formSchema) as {
      properties: Record<string, { type: string }>;
    };
    assert.equal(out.properties.badField.type, "string");
  });

  it("空/非法入参不抛异常，返回空对象 Schema", () => {
    assert.doesNotThrow(() => normalizeFormSchemaToJsonSchema(null));
    assert.doesNotThrow(() => normalizeFormSchemaToJsonSchema(undefined));
    assert.doesNotThrow(() => normalizeFormSchemaToJsonSchema("not-an-object"));
    const out = normalizeFormSchemaToJsonSchema(null) as { type: string };
    assert.equal(out.type, "object");
  });

  it("单字段异常隔离：坏字段不污染全局", () => {
    const formSchema = {
      good: { type: "string", required: true },
      // 故意让该字段在迭代中触发异常：key 为空会被跳过而非抛
      bad: null as unknown as { type: string },
    };
    const out = normalizeFormSchemaToJsonSchema(formSchema) as {
      properties: Record<string, unknown>;
      required?: string[];
    };
    assert.ok(out.properties.good);
    // bad 字段应被隔离跳过，不抛异常
    assert.equal(out.required?.includes("good"), true);
  });
});

describe("base/openapi — buildOpenApiDoc 官方 5 弹全量解析", () => {
  it("5 官方弹药全量生成：openapi 3.0.3 / paths 三件套 / schemas 去重", async () => {
    const { listRegisteredAmmos } = await import("../../ammo/registry.ts");
    const ammos = listRegisteredAmmos();
    // 物理口径：官方 5 枚去重后 ≥5（动态池空时恰 5，动态池有追加时 >5）
    const ammoIds = ammos.map((a) => a.ammoId).sort();
    assert.ok(ammoIds.includes("housekeeping-v1"), "缺 housekeeping-v1");
    assert.ok(ammoIds.includes("meetup-social-v1"), "缺 meetup-social-v1");
    assert.ok(ammoIds.includes("companion-v1"), "缺 companion-v1");
    assert.ok(ammoIds.includes("appliance-repair-v1"), "缺 appliance-repair-v1");
    assert.ok(ammoIds.includes("pet-boarding-v1"), "缺 pet-boarding-v1");

    const doc = buildOpenApiDoc(ammos, { version: "3.9.0", baseUrl: "http://localhost:3000" });
    assert.equal(doc.openapi, "3.0.3");
    assert.equal(doc.info.version, "3.9.0");
    assert.equal(doc.info.title, "deal-protocol O2O Universal API");
    assert.ok(doc.paths["/api/orders"], "缺 /api/orders");
    assert.ok(doc.paths["/api/orders/{id}/transition"], "缺 /api/orders/{id}/transition");
    assert.ok(doc.paths["/api/openapi.json"], "缺 /api/openapi.json");
    // 每枚弹药对应 PublishRequest + PricingModel + FuzePolicy 三组件（5×3=15 基数，pet 额外 settlement 等）
    const schemaKeys = Object.keys(doc.components.schemas);
    assert.ok(schemaKeys.includes("housekeeping-v1PublishRequest"));
    assert.ok(schemaKeys.includes("appliance-repair-v1PublishRequest"));
    assert.ok(schemaKeys.includes("pet-boarding-v1PublishRequest"));
    // 扩展字段
    const hkPublish = doc.components.schemas["housekeeping-v1PublishRequest"] as Record<string, unknown>;
    assert.ok("x-fuze-policy" in hkPublish || "x-fuze-id" in hkPublish);
    assert.ok("x-action-schema" in hkPublish || "x-supply-cluster" in hkPublish);
    // D8 formSchema → bizParams
    const applianceSchema = doc.components.schemas["appliance-repair-v1PublishRequest"] as {
      properties: { bizParams: { properties: Record<string, unknown> } };
    };
    assert.ok(applianceSchema.properties.bizParams.properties.applianceType);
    assert.ok(applianceSchema.properties.bizParams.properties.faultDescription);
  });
});

describe("base/openapi — 动态热注弹药即时反射", () => {
  it("registerDynamicAmmo 热注后 buildOpenApiDoc 即时出现新弹药 oneOf 与 x-ammo-registry", async () => {
    const { registerDynamicAmmo, DYNAMIC_AMMO_POOL } = await import("../../ammo/factory.ts");
    const { listRegisteredAmmos } = await import("../../ammo/registry.ts");

    const testAmmoId = `test-dynamic-openapi-${Date.now()}`;
    const res = registerDynamicAmmo({
      ammoId: testAmmoId,
      category: testAmmoId,
      version: "1.0.0",
      supplyCluster: "C1_MOBILITY",
      pricingModel: { kind: "FIXED", amountYuan: 99 },
      fuzePolicy: { fuzeId: "test-fuze", fuzeTypes: ["IMPACT"] } as never,
      theme: "default",
      aliases: ["测试动态弹药"],
      formSchema: {
        customField: { type: "string", required: true },
      },
      splitRules: { providerRatio: 0.85, platformRatio: 0.1, insuranceRatio: 0.05 },
    } as never);
    assert.equal(res.ok, true, `动态弹药出厂被拒: ${!res.ok ? (res as { errors: string[] }).errors.join(";") : ""}`);

    try {
      const ammos = listRegisteredAmmos();
      const doc = buildOpenApiDoc(ammos);
      const schemaKey = `${testAmmoId}PublishRequest`;
      assert.ok(doc.components.schemas[schemaKey], `缺动态弹药 schema ${schemaKey}`);
      const ammoIds = (doc["x-ammo-registry"] as { ammoIds: string[] }).ammoIds;
      assert.ok(ammoIds.includes(testAmmoId), "x-ammo-registry 未反射动态弹药");
      // oneOf 应包含新弹药
      const orderPath = doc.paths["/api/orders"] as {
        post: { requestBody: { content: { "application/json": { schema: { oneOf: Array<{ $ref: string }> } } } } };
      };
      const refs = orderPath.post.requestBody.content["application/json"].schema.oneOf.map((o) => o.$ref);
      assert.ok(refs.some((r) => r.includes(testAmmoId)), "oneOf 未包含动态弹药");
    } finally {
      // 清理动态池，避免污染后续用例（listRegisteredAmmos 去重聚合，删除即消失）
      DYNAMIC_AMMO_POOL.delete(testAmmoId);
    }
  });
});

describe("base/openapi — 异常隔离与空池兜底", () => {
  it("空数组不抛 500，返回合规空 OpenAPI 骨架", () => {
    const doc = buildOpenApiDoc([]);
    assert.equal(doc.openapi, "3.0.3");
    assert.equal(doc.info.title, "deal-protocol O2O Universal API");
    assert.deepEqual(doc["x-ammo-registry"], {
      count: 0,
      ammoIds: [],
      generatedAt: (doc["x-ammo-registry"] as { generatedAt: string }).generatedAt,
      holographicSource: "IAmmoDefinition.holographic (D1~D9)",
    });
    assert.equal((doc["x-ammo-registry"] as { count: number }).count, 0);
    // paths 三件套仍在（空 oneOf 回落为 type:object）
    assert.ok(doc.paths["/api/orders"]);
  });

  it("单弹药 formSchema 异常仅隔离该弹药，不污染全局", () => {
    const good = mkAmmo({ ammoId: "good-v1", category: "good" });
    const bad = mkAmmo({
      ammoId: "bad-v1",
      category: "bad",
      holographic: {
        ammoId: "bad-v1",
        category: "bad",
        version: "1.0.0",
        supplyCluster: "C1_MOBILITY",
        pricingModel: { kind: "FIXED", amountYuan: 1 },
        fuzePolicy: { fuzeId: "x", fuzeTypes: ["IMPACT"] } as never,
        // 故意让 formSchema 为循环引用等异常形态，normalize 内部 try/catch 应兜底
        formSchema: null as unknown as Record<string, unknown>,
        theme: "default",
      } as never,
    });
    assert.doesNotThrow(() => buildOpenApiDoc([good, bad]));
    const doc = buildOpenApiDoc([good, bad]);
    assert.ok(doc.components.schemas["good-v1PublishRequest"]);
    assert.ok(doc.components.schemas["bad-v1PublishRequest"], "坏弹药应被隔离为 fallback schema 而非消失");
  });

  it("非法入参（null/undefined/非数组）不抛异常", () => {
    assert.doesNotThrow(() => buildOpenApiDoc(null as unknown as IAmmoDefinition[]));
    assert.doesNotThrow(() => buildOpenApiDoc(undefined as unknown as IAmmoDefinition[]));
    const doc = buildOpenApiDoc(null as unknown as IAmmoDefinition[]);
    assert.equal(doc.openapi, "3.0.3");
  });
});

describe("base/openapi — 确定性字典序与稳定序列化（防 flake）", () => {
  it("两次调用字节一致（入参乱序仍输出稳定排序）", async () => {
    const { listRegisteredAmmos } = await import("../../ammo/registry.ts");
    const ammos = listRegisteredAmmos();
    const shuffled = [...ammos].reverse();
    const a = buildOpenApiDoc(ammos, { version: "3.9.0", baseUrl: "http://localhost:3000" });
    const b = buildOpenApiDoc(shuffled, { version: "3.9.0", baseUrl: "http://localhost:3000" });
    // 消除 generatedAt 时间戳差异后做稳定序列化对比
    const norm = (doc: unknown) => {
      const copy = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;
      const reg = copy["x-ammo-registry"] as Record<string, unknown>;
      if (reg) reg.generatedAt = "STABLE";
      // 递归键排序稳定化
      const stable = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(stable);
        if (v && typeof v === "object") {
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(v as Record<string, unknown>).sort()) {
            out[k] = stable((v as Record<string, unknown>)[k]);
          }
          return out;
        }
        return v;
      };
      return JSON.stringify(stable(copy));
    };
    assert.equal(norm(a), norm(b), "两次调用稳定序列化后字节不一致（存在 Map 枚举序抖动）");
  });

  it("components.schemas 键名已字典序排序", async () => {
    const { listRegisteredAmmos } = await import("../../ammo/registry.ts");
    const doc = buildOpenApiDoc(listRegisteredAmmos());
    const keys = Object.keys(doc.components.schemas);
    const sorted = [...keys].sort();
    assert.deepEqual(keys, sorted, "components.schemas 键名未字典序排序");
  });
});
