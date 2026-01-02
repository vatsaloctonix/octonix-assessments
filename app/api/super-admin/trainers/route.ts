import { NextResponse } from "next/server";
import { getSessionFromCookie, requireSuperAdmin, hashPassword } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

// GET /api/super-admin/trainers - List all trainers
export async function GET() {
  try {
    const sessionData = await getSessionFromCookie();
    requireSuperAdmin(sessionData?.admin || null);

    const supabase = createSupabaseServiceClient();

    const { data: trainers, error } = await supabase
      .from("admins")
      .select("id, email, name, role, is_active, created_at, created_by")
      .eq("role", "trainer")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trainers });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Get trainers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/super-admin/trainers - Create new trainer
export async function POST(request: Request) {
  try {
    const sessionData = await getSessionFromCookie();
    requireSuperAdmin(sessionData?.admin || null);

    const { email, name, password } = await request.json();

    // Validate input
    if (!email || !name || !password) {
      return NextResponse.json(
        { error: "Email, name, and password are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();

    // Check if email already exists
    const { data: existing } = await supabase
      .from("admins")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existing) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create trainer
    const { data: trainer, error } = await supabase
      .from("admins")
      .insert({
        email: email.toLowerCase().trim(),
        name,
        password_hash,
        role: "trainer",
        is_active: true,
        created_by: sessionData!.admin.id,
      })
      .select("id, email, name, role, is_active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ trainer }, { status: 201 });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Create trainer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
