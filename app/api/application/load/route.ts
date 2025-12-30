import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const { token } = (await request.json()) as { token?: string };
  if (!token) return new NextResponse("Missing token", { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("candidate_assessments").select("*").eq("token", token).single();
  if (error) return new NextResponse("Invalid link", { status: 404 });

  return NextResponse.json({ ok: true, assessment: data });
}
