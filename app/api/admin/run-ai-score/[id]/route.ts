import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";
import { evaluateWithGroq } from "@/lib/groq";
import { ROLE_MARKET } from "@/lib/assessmentConfig";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();

  const { data: item, error } = await supabase.from("candidate_assessments").select("*").eq("id", id).single();
  if (error) return new NextResponse(error.message, { status: 500 });

  const roleId = item?.answers?.domain?.selectedRoleId ?? null;
  const roleLabel = roleId ? (ROLE_MARKET.find((r) => r.roleId === roleId)?.label ?? roleId) : null;

  const evaluation = await evaluateWithGroq({
    roleLabel,
    answers: item.answers ?? {},
    proctoring: item.proctoring ?? {},
  });

  const { error: updateError } = await supabase
    .from("candidate_assessments")
    .update({ ai_evaluations: { ...(item.ai_evaluations ?? {}), overall: evaluation } })
    .eq("id", id);

  if (updateError) return new NextResponse(updateError.message, { status: 500 });
  return NextResponse.json({ ok: true });
}
