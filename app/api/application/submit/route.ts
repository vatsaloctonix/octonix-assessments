import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token?: string };
  if (!token) return new NextResponse("Missing token", { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data: existing, error: loadError } = await supabase.from("candidate_assessments").select("*").eq("token", token).single();
  if (loadError) return new NextResponse("Invalid link", { status: 404 });
  if (existing.status === "submitted") return NextResponse.json({ ok: true });

  const { error: updateError } = await supabase.from("candidate_assessments").update({ status: "submitted", submitted_at: new Date().toISOString() }).eq("token", token);
  if (updateError) return new NextResponse(updateError.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
