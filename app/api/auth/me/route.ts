import { NextResponse } from "next/server";
import { getSessionFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    const sessionData = await getSessionFromCookie();

    if (!sessionData) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      admin: {
        id: sessionData.admin.id,
        email: sessionData.admin.email,
        role: sessionData.admin.role,
        name: sessionData.admin.name,
      },
    });
  } catch (error: any) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
