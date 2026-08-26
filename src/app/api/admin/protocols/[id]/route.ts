import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
// D-5 Phase E（裁决 1）：协议详情直读 Base 静态资产；DB 热配写回已退役。
import { PROTOCOLS } from "@/base/order/protocol-definitions";

export const GET = withAuth(async (req, user, ...args) => {
  try {
    const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
    const svc = getServiceClient();
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    const def = PROTOCOLS[id];
    if (!def) {
      return NextResponse.json({ error: "协议不存在" }, { status: 404 });
    }
    // 字段形状与旧 DB 行兼容（config 列为 JSON 字符串）
    const detail = {
      id: def.id,
      name: def.name,
      description: def.description,
      category: def.category,
      enabled: true,
      version: def.version,
      source: "base-static",
      config: JSON.stringify(def),
      versions: [{ version: def.version, created_at: null }],
    };
    return NextResponse.json({ protocol: detail });
  } catch (e) {
    return NextResponse.json({ error: '获取协议详情失败', detail: String(e) }, { status: 500 });
  }
})

export const PATCH = withAuth(async (req, user, ...args) => {
  try {
    await (args[0] as { params: Promise<{ id: string }> }).params;
    const svc = getServiceClient();
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'reload') {
      // 静态资产无需重载：保留成功响应以兼容管理台「同步」按钮语义
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "静态协议资产不可变更（D-5 裁决 1：协议 CRUD 热配已退役）" },
      { status: 400 },
    );
  } catch (e) {
    return NextResponse.json({ error: '操作失败', detail: String(e) }, { status: 500 });
  }
})
