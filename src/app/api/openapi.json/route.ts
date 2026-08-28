import { NextResponse } from "next/server";
import { buildOpenApiDoc } from "@/base/openapi/generator";
import { listRegisteredAmmos } from "@/ammo/registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveBaseUrl(req: Request): string {
  try {
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    if (host && host.trim() !== "") return `${proto}://${host}`;
  } catch {
    // ignore, fallback to default
  }
  return "http://localhost:3000";
}

function buildFallbackDoc(baseUrl: string) {
  return {
    openapi: "3.0.3",
    info: {
      title: "deal-protocol O2O Universal API",
      version: "3.9.0",
      description:
        "deal-protocol 弹药全息自描述 O2O Universal API（由 IAmmoDefinition 全息配置动态派生，第三方 1h 接入）。",
    },
    servers: [{ url: baseUrl, description: "Current server" }],
    paths: {
      "/api/orders": {
        post: {
          tags: ["orders"],
          summary: "发布订单（弹药自描述多态）",
          responses: { "200": { description: "发布成功" } },
        },
      },
      "/api/orders/{id}/transition": {
        post: {
          tags: ["orders"],
          summary: "订单五态跃迁（AtomicFiveState）",
          responses: { "200": { description: "跃迁成功" } },
        },
      },
      "/api/openapi.json": {
        get: {
          tags: ["system"],
          summary: "弹药自描述 OpenAPI 3.0.3 文档（本接口）",
          responses: { "200": { description: "OpenAPI 文档" } },
        },
      },
    },
    components: { schemas: {} },
    tags: [],
    "x-ammo-registry": {
      count: 0,
      ammoIds: [],
      generatedAt: new Date().toISOString(),
      holographicSource: "IAmmoDefinition.holographic (D1~D9)",
    },
  };
}

export async function GET(req: Request) {
  const baseUrl = resolveBaseUrl(req);
  try {
    const ammos = listRegisteredAmmos();
    const doc = buildOpenApiDoc(ammos, {
      version: "3.9.0",
      baseUrl,
      title: "deal-protocol O2O Universal API",
    });
    return NextResponse.json(doc, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch {
    const fallback = buildFallbackDoc(baseUrl);
    return NextResponse.json(fallback, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  }
}
