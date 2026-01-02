import { NextResponse } from "next/server";
import { getSessionFromCookie, requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

// DELETE /api/super-admin/trainers/[id] - Deactivate trainer (soft delete)
export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionData = await getSessionFromCookie();
    requireSuperAdmin(sessionData?.admin || null);

    const supabase = createSupabaseServiceClient();

    // Soft delete by setting is_active = false
    const { error } = await supabase
      .from("admins")
      .update({ is_active: false })
      .eq("id", id)
      .eq("role", "trainer"); // Only allow deleting trainers, not super admins

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also delete all active sessions for this trainer
    await supabase.from("sessions").delete().eq("admin_id", id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Delete trainer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/super-admin/trainers/[id] - Update trainer (activate/deactivate)
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const sessionData = await getSessionFromCookie();
    requireSuperAdmin(sessionData?.admin || null);

    const { is_active } = await request.json();

    if (typeof is_active !== "boolean") {
      return NextResponse.json({ error: "is_active must be a boolean" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    const { error } = await supabase
      .from("admins")
      .update({ is_active })
      .eq("id", id)
      .eq("role", "trainer");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // If deactivating, delete sessions
    if (!is_active) {
      await supabase.from("sessions").delete().eq("admin_id", id);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Update trainer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
