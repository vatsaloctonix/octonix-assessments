import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";
import type { VideoBehaviorEvaluation } from "@/lib/types";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const behavior: VideoBehaviorEvaluation = await request.json();

  const supabase = createSupabaseServiceClient();

  const { error } = await supabase
    .from("candidate_assessments")
    .update({ video_behavior: behavior })
    .eq("id", id);

  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
