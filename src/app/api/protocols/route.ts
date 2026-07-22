import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { getDbProtocols } from "@/lib/protocol/bootstrap";

export const GET = withAuth(async () => {
  const protocols = await getDbProtocols();

  const result = protocols.map((p) => {
    const config = p.versions[0] ? JSON.parse(p.versions[0].config) : null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      version: config?.version ?? "unknown",
      funding: config ? { mode: config.funding.mode, hold: config.funding.hold, release: config.funding.release } : null,
      review: config ? { dimensionCount: config.review?.dimensions?.length ?? 0, labelExtraction: config.review?.labelExtraction } : null,
      dispute: config ? { channels: Object.keys(config.dispute?.channels ?? {}) } : null,
    };
  });

  return NextResponse.json({ protocols: result });
});
