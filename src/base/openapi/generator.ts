/**
 * P2-1-OpenAPI · 纯函数 OpenAPI 3.0.3 生成器（base/openapi，红线 3 零反向依赖）。
 *
 * 职责：IAmmoDefinition[]（由路由层 listRegisteredAmmos() 注入）→ OpenAPIDocument 纯数据。
 * 严禁 import @/ammo/* 或 @/adapters/*，入参即全部真理源（宪法 #1/#4，红线 3）。
 */

import type { IAmmoDefinition } from "../../types/ammo-schema.ts";
import type { IFuzePolicy } from "../../types/fuze-policy.ts";

// @/ammo/* 禁止 import — 纯函数入参注入（红线 3）

export interface OpenAPIDocument {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string; description?: string }>;
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
  tags?: Array<{ name: string; description?: string }>;
  "x-ammo-registry"?: Record<string, unknown>;
}

export interface BuildOpenApiOptions {
  version?: string;
  baseUrl?: string;
  title?: string;
}

type JsonSchema = Record<string, unknown>;

function toJsonType(raw: unknown): string {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "string" || s === "text") return "string";
  if (s === "number" || s === "integer" || s === "float") return "number";
  if (s === "boolean" || s === "bool" || s === "switch") return "boolean";
  if (s === "select" || s === "enum" || s === "picker" || s === "choices") return "enum";
  if (s === "array") return "array";
  if (s === "object") return "object";
  return "string";
}

/**
 * D8 formSchema → JSON Schema 双形态归一化（纯函数，异常隔离不抛）。
 * 支持：
 *  - 形态 A: { fields: [{key,type,required,options}] } 数组形态
 *  - 形态 B: { [key]: {type,required,options} } 对象映射形态（现役主形态）
 * 非法 type 保底 string，单字段异常隔离（不污染全局）。
 */
export function normalizeFormSchemaToJsonSchema(
  formSchema: unknown,
): JsonSchema {
  try {
    if (!formSchema || typeof formSchema !== "object") {
      return { type: "object", properties: {}, required: [] };
    }
    const schema = formSchema as Record<string, unknown>;
    let fields: Record<string, unknown>[] = [];

    if (Array.isArray((schema as { fields?: unknown }).fields)) {
      const arr = (schema as { fields: unknown[] }).fields;
      fields = arr.filter(
        (f): f is Record<string, unknown> => !!f && typeof f === "object",
      ) as Record<string, unknown>[];
    } else {
      const entries = Object.entries(schema);
      const isMap = entries.some(
        ([, v]) =>
          v !== null &&
          typeof v === "object" &&
          "type" in (v as Record<string, unknown>),
      );
      if (isMap) {
        fields = entries.map(([key, def]) => ({
          key,
          ...(def as Record<string, unknown>),
        }));
      } else {
        // 空或非标准形态
        return { type: "object", properties: {}, required: [] };
      }
    }

    const properties: Record<string, JsonSchema> = {};
    const required: string[] = [];

    for (const f of fields) {
      try {
        if (!f || typeof f !== "object") continue;
        const rawKey = typeof f.key === "string" ? f.key.trim() : "";
        if (!rawKey) continue;
        const mapped = toJsonType(f.type);
        let prop: JsonSchema;
        if (mapped === "enum") {
          const rawOptions = Array.isArray(f.options)
            ? (f.options as unknown[])
            : Array.isArray((f as { choices?: unknown }).choices)
              ? ((f as { choices?: unknown }).choices as unknown[])
              : undefined;
          const options = rawOptions?.filter(
            (o): o is string => typeof o === "string" && o.trim() !== "",
          );
          prop = {
            type: "string",
            ...(options && options.length > 0 ? { enum: options } : {}),
          };
        } else if (mapped === "array") {
          prop = { type: "array", items: { type: "string" } };
        } else if (mapped === "object") {
          prop = { type: "object" };
        } else {
          prop = { type: mapped };
        }
        // 非法 type 已在 toJsonType 回落 string，无需额外处理
        properties[rawKey] = prop;
        if (f.required === true) required.push(rawKey);
      } catch {
        // 单字段异常隔离，跳过该字段
        continue;
      }
    }

    const out: JsonSchema = { type: "object", properties };
    if (required.length > 0) out.required = required;
    // 键名排序稳定化（消除对象枚举序抖动）
    const sortedProps: Record<string, JsonSchema> = {};
    for (const k of Object.keys(properties).sort()) {
      sortedProps[k] = properties[k];
    }
    out.properties = sortedProps;
    if (required.length > 0) {
      out.required = [...required].sort();
    }
    return out;
  } catch {
    return {
      type: "object",
      properties: {},
      description: "invalid formSchema fallback",
    };
  }
}

function buildPricingSchema(ammo: IAmmoDefinition): JsonSchema {
  try {
    const pm = ammo.pricingModel;
    if (!pm || typeof pm !== "object") return { type: "object" };
    const kind = (pm as { kind?: string }).kind;
    if (kind === "FIXED") {
      return {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["FIXED"] },
          amountYuan: { type: "number" },
        },
        required: ["kind", "amountYuan"],
        "x-pricing-kind": kind,
      } as JsonSchema;
    }
    if (kind === "HOURLY") {
      return {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["HOURLY"] },
          rateYuan: { type: "number" },
          minHours: { type: "number" },
        },
        required: ["kind", "rateYuan", "minHours"],
        "x-pricing-kind": kind,
      } as JsonSchema;
    }
    if (kind === "PER_SEAT") {
      return {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["PER_SEAT"] },
          perSeatYuan: { type: "number" },
          minSeats: { type: "number" },
        },
        required: ["kind", "perSeatYuan", "minSeats"],
        "x-pricing-kind": kind,
      } as JsonSchema;
    }
    if (kind === "FORMULA") {
      return {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["FORMULA"] },
          formulaId: { type: "string" },
          params: { type: "object" },
        },
        required: ["kind", "formulaId"],
        "x-pricing-kind": kind,
      } as JsonSchema;
    }
    return { type: "object", "x-pricing-kind": String(kind ?? "unknown") } as JsonSchema;
  } catch {
    return { type: "object", description: "pricing fallback" };
  }
}

function buildFuzeExtension(fuzePolicy: IFuzePolicy | undefined): Record<string, unknown> {
  try {
    if (!fuzePolicy || typeof fuzePolicy !== "object") return {};
    const fp = fuzePolicy as unknown as Record<string, unknown>;
    return {
      "x-fuze-policy": {
        fuzeId: fp.fuzeId ?? null,
        fuzeTypes: fp.fuzeTypes ?? [],
        description: fp.description ?? null,
      },
      "x-fuze-id": fp.fuzeId ?? null,
    };
  } catch {
    return {};
  }
}

function stableKeyOf(ammo: IAmmoDefinition): string {
  return ammo.ammoId || ammo.category || "unknown";
}

function sortAmms(ammos: IAmmoDefinition[]): IAmmoDefinition[] {
  return [...ammos].sort((a, b) => stableKeyOf(a).localeCompare(stableKeyOf(b)));
}

/**
 * 纯函数 OpenAPI 3.0.3 文档生成（确定性、无副作用、异常隔离）。
 * 扩展字段：x-fuze-policy / x-action-schema / x-supply-cluster / x-settlement-rules / x-sla-phases / x-cancellation-tiers
 */
export function buildOpenApiDoc(
  ammos: IAmmoDefinition[],
  opts?: BuildOpenApiOptions,
): OpenAPIDocument {
  const safeAmms = Array.isArray(ammos) ? ammos : [];

  const version = opts?.version?.trim() || "3.9.0";
  const baseUrl = opts?.baseUrl?.trim() || "http://localhost:3000";
  const title = opts?.title?.trim() || "deal-protocol O2O Universal API";

  const sorted = sortAmms(safeAmms);

  const schemas: Record<string, JsonSchema> = {};
  const tags: Array<{ name: string; description?: string }> = [];

  for (const ammo of sorted) {
    try {
      const ammoId = stableKeyOf(ammo);
      const safeAmmoId = ammoId.replace(/[^a-zA-Z0-9-_]/g, "-");
      // 每个弹药的发布请求体 Schema（D8 formSchema → JSON Schema）
      const formJson = normalizeFormSchemaToJsonSchema(
        ammo.holographic?.formSchema,
      );
      const publishSchemaKey = `${safeAmmoId}PublishRequest`;
      schemas[publishSchemaKey] = {
        type: "object",
        properties: {
          category: { type: "string", enum: [ammo.category, ammoId] },
          ammoId: { type: "string", enum: [ammoId] },
          bizParams: formJson,
          note: { type: "string" },
        },
        required: ["category"],
        "x-ammo-id": ammoId,
        "x-category": ammo.category,
        "x-supply-cluster": ammo.supplyCluster ?? null,
        "x-theme": ammo.holographic?.theme ?? null,
        ...buildFuzeExtension(ammo.fuzePolicy),
        ...(ammo.holographic?.actionSchema
          ? { "x-action-schema": ammo.holographic.actionSchema }
          : {}),
        ...(ammo.holographic?.cancellationTiers
          ? { "x-cancellation-tiers": ammo.holographic.cancellationTiers }
          : {}),
        ...(ammo.holographic?.splitRules
          ? { "x-settlement-rules": ammo.holographic.splitRules }
          : {}),
        ...(ammo.holographic?.slaPhases
          ? { "x-sla-phases": ammo.holographic.slaPhases }
          : {}),
        "x-funding-mode": (ammo.holographic as unknown as Record<string, unknown>)?.fundingMode ?? null,
      } as JsonSchema;

      // 定价与风控扩展 Schema（可复用组件）
      const pricingKey = `${safeAmmoId}PricingModel`;
      schemas[pricingKey] = buildPricingSchema(ammo);

      const fuzeKey = `${safeAmmoId}FuzePolicy`;
      schemas[fuzeKey] = {
        type: "object",
        properties: {
          fuzeId: { type: "string" },
          fuzeTypes: { type: "array", items: { type: "string" } },
        },
        "x-fuze-policy": ammo.fuzePolicy ?? null,
      } as JsonSchema;

      // 结算/违约扩展
      if (ammo.holographic?.splitRules) {
        const settleKey = `${safeAmmoId}SettlementRules`;
        schemas[settleKey] = {
          type: "object",
          properties: {
            providerRatio: { type: "number" },
            platformRatio: { type: "number" },
            insuranceRatio: { type: "number" },
          },
          required: ["providerRatio", "platformRatio", "insuranceRatio"],
          "x-supply-cluster": ammo.supplyCluster ?? null,
          example: ammo.holographic.splitRules,
        } as JsonSchema;
      }

      tags.push({
        name: ammoId,
        description: `${ammo.category} (${ammo.version}) · ${ammo.supplyCluster ?? "unclustered"}`,
      });
    } catch {
      // 单弹药异常隔离：跳过该弹药，不污染全局文档
      continue;
    }
  }

  // 键名排序稳定化（components.schemas）
  const sortedSchemas: Record<string, JsonSchema> = {};
  for (const k of Object.keys(schemas).sort()) {
    sortedSchemas[k] = schemas[k];
  }
  const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  // 构建 oneOf 展开（POST /api/orders 发布多态）
  const oneOfRefs: Array<Record<string, string>> = [];
  for (const ammo of sorted) {
    try {
      const ammoId = stableKeyOf(ammo);
      const safeAmmoId = ammoId.replace(/[^a-zA-Z0-9-_]/g, "-");
      oneOfRefs.push({ $ref: `#/components/schemas/${safeAmmoId}PublishRequest` });
    } catch {
      continue;
    }
  }

  const paths: Record<string, unknown> = {
    "/api/orders": {
      post: {
        tags: ["orders"],
        summary: "发布订单（弹药自描述多态）",
        description:
          "按弹药全息配置动态派生的发布接口；x-ammo-id 指定目标弹药，bizParams 由各弹药 D8 formSchema 派生（publish via ammo registry, holographic.formSchema → JSON Schema）。",
        operationId: "publishOrder",
        parameters: [
          {
            name: "x-ammo-id",
            in: "header",
            required: false,
            schema: { type: "string", enum: sorted.map((a) => stableKeyOf(a)) },
            description: "目标弹药标识（ammoId），缺省按 category 自动路由",
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema:
                oneOfRefs.length > 0
                  ? { oneOf: oneOfRefs, discriminator: { propertyName: "ammoId" } }
                  : { type: "object" },
            },
          },
        },
        responses: {
          "200": { description: "发布成功", content: { "application/json": { schema: { type: "object" } } } },
          "400": { description: "参数校验失败" },
        },
        "x-ammo-ids": sorted.map((a) => stableKeyOf(a)),
      },
    },
    "/api/orders/{id}/transition": {
      post: {
        tags: ["orders"],
        summary: "订单五态跃迁（AtomicFiveState）",
        description:
          "通用五态机跃迁：PUBLISHED→MATCHED→IN_SERVICE→INSPECTED→SETTLED，经 AmmoRunner + CAS 乐观锁校验（advanceLifecycle）。",
        operationId: "transitionOrder",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "订单 ID / order_no" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  to: {
                    type: "string",
                    enum: ["PUBLISHED", "MATCHED", "IN_SERVICE", "INSPECTED", "SETTLED"],
                  },
                  expectedVersion: { type: "number" },
                  payload: { type: "object" },
                },
                required: ["to"],
              },
            },
          },
        },
        responses: {
          "200": { description: "跃迁成功" },
          "409": { description: "版本冲突 / 状态漂移" },
        },
      },
    },
    "/api/openapi.json": {
      get: {
        tags: ["system"],
        summary: "弹药自描述 OpenAPI 3.0.3 文档（本接口）",
        operationId: "getOpenApiDoc",
        responses: {
          "200": {
            description: "OpenAPI 文档",
            content: { "application/json": { schema: { type: "object" } } },
          },
        },
      },
    },
  };

  const ammoIds = sorted.map((a) => stableKeyOf(a));
  const doc: OpenAPIDocument = {
    openapi: "3.0.3",
    info: {
      title,
      version,
      description:
        "deal-protocol 弹药全息自描述 O2O Universal API（由 IAmmoDefinition 全息配置动态派生，第三方 1h 接入）。",
    },
    servers: [{ url: baseUrl, description: "Current server" }],
    paths,
    components: { schemas: sortedSchemas },
    tags: sortedTags,
    "x-ammo-registry": {
      count: sorted.length,
      ammoIds: [...ammoIds].sort(),
      generatedAt: new Date().toISOString(),
      holographicSource: "IAmmoDefinition.holographic (D1~D9)",
    },
  };

  return doc;
}
