import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getServiceClient } from "@/lib/supabase-client";
// D-5 Phase E（裁决 1）：协议定义资产化常驻 Base，管理台收敛为只读展示——
// DB 热配链路（bootstrap reloadFromDb / syncBuiltinsToDb）已物理退役。
import { PROTOCOLS } from "@/base/order/protocol-definitions";

export const POST = withAuth(async (req, user) => {
  try {
    const svc = getServiceClient()
    const { data: profile } = await svc.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'ADMIN') {
      return NextResponse.json({ error: '仅管理员可访问' }, { status: 403 });
    }

    // 静态全息协议数据投影（字段形状与旧 DB 行兼容：id/name/category/enabled/versions）
    const protocols = Object.values(PROTOCOLS).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      enabled: true,
      version: d.version,
      source: "base-static" as const,
      versions: [{ version: d.version, created_at: null }],
    }));
    return NextResponse.json({ protocols });
  } catch (e) {
    return NextResponse.json({ error: '读取协议资产失败', detail: String(e) }, { status: 500 });
  }
})
