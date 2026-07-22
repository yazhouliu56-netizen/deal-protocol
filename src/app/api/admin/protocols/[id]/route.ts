import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { protocolRegistry } from "@/lib/protocol/registry";
import { clearEngineCache } from "@/lib/protocol/engine";
import { getDbProtocolDetail, reloadFromDb } from "@/lib/protocol/bootstrap";

export const GET = withAuth(async (req, user, ...args) => {
  try {
    const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
    const svc = getServiceClient();
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    const detail = await getDbProtocolDetail(id);
    if (!detail) {
      return NextResponse.json({ error: "协议不存在" }, { status: 404 });
    }
    return NextResponse.json({ protocol: detail });
  } catch (e) {
    return NextResponse.json({ error: '获取协议详情失败', detail: String(e) }, { status: 500 });
  }
})

export const PATCH = withAuth(async (req, user, ...args) => {
  try {
    const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;
    const svc = getServiceClient();
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'reload') {
      await reloadFromDb();
      clearEngineCache();
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "未知操作" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: '操作失败', detail: String(e) }, { status: 500 });
  }
})
