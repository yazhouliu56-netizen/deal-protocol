import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";

export const GET = withAuth(async (req, user, ...args) => {
  const { id } = await (args[0] as { params: Promise<{ id: string }> }).params;

  const { getSupabase } = await import("@/lib/supabase-client");
  const supabase = getSupabase();

  const { data: protocol, error } = await supabase
    .from('platform_config')
    .select('*')
    .eq('id', id)
    .eq('enabled', true)
    .single();

  if (error || !protocol) {
    return NextResponse.json({ error: "协议不存在或未启用" }, { status: 404 });
  }

  const { data: versions } = await supabase
    .from('protocol_versions')
    .select('*')
    .eq('protocol_id', id)
    .order('created_at', { ascending: false })
    .limit(1);

  const config = versions && versions[0] ? JSON.parse(versions[0].config) : null;

  return NextResponse.json({
    protocol: {
      id: protocol.id,
      name: protocol.name,
      description: protocol.description,
      category: protocol.category,
      version: config?.version ?? "unknown",
      states: config?.states ?? [],
      serviceStages: config?.serviceStages ?? [],
      transitions: config?.transitions ?? [],
      refundRules: config?.refundRules ?? [],
      funding: config?.funding ?? null,
      review: config?.review ?? null,
      dispute: config?.dispute ?? null,
      evidence: config?.evidence ?? [],
      completion: config?.completion ?? null,
      default: config?.default ?? null,
    },
  });
});
