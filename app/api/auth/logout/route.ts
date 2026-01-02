import { NextResponse } from "next/server";
import { deleteSessionCookie, getSessionFromCookie, deleteSession } from "@/lib/auth";

export async function POST() {
  try {
    const sessionData = await getSessionFromCookie();

    if (sessionData) {
      // Delete session from database
      await deleteSession(sessionData.session.token);
    }

    // Delete cookie
    await deleteSessionCookie();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
