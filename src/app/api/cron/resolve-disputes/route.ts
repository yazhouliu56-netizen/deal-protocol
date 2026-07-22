import { NextResponse, NextRequest } from "next/server";
import { processPendingDisputes } from "@/lib/dispute/resolver";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results = await processPendingDisputes();
    return NextResponse.json({ processed: results.length, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("resolve-disputes cron failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
