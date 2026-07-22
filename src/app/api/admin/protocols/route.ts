import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
import { getDbProtocols, reloadFromDb } from "@/lib/protocol/bootstrap";

export const GET = withAuth(async (req, user) => {
  try {
    const svc = getServiceClient()
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    const protocols = await getDbProtocols();
    return NextResponse.json({ protocols });
  } catch (e) {
    return NextResponse.json({ error: '获取协议失败', detail: String(e) }, { status: 500 });
  }
})

export const POST = withAuth(async (req, user) => {
  try {
    const svc = getServiceClient()
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    await reloadFromDb();
    const protocols = await getDbProtocols();
    return NextResponse.json({ protocols });
  } catch (e) {
    return NextResponse.json({ error: '同步失败', detail: String(e) }, { status: 500 });
  }
})
