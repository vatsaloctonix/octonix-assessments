import { createSupabaseServiceClient } from "@/lib/supabaseServer";
import { NextResponse } from "next/server";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase.from("candidate_assessments").select("*").eq("id", id).single();
  if (error) return new NextResponse(error.message, { status: 500 });

  const response = new NextResponse(JSON.stringify(data, null, 2), { status: 200 });
  response.headers.set("Content-Type", "application/json");
  response.headers.set("Content-Disposition", `attachment; filename="octonix-assessment-${id}.json"`);
  return response;
}
