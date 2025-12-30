import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

export async function GET() {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.from("candidate_assessments").select("*").order("updated_at", { ascending: false }).limit(200);
  if (error) return new NextResponse(error.message, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}
