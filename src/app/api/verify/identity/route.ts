import { NextResponse } from "next/server";
import { verifyIdentity } from "@/modules/m02-auth/verify-identity";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, phone, realName, idNumber, category } = body;

    if (!userId || !phone || !realName || !idNumber || !category) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    const result = await verifyIdentity({ userId, phone, realName, idNumber, category });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
