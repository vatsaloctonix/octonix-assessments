import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

function deepMerge(base: any, patch: any): any {
  if (Array.isArray(base) || Array.isArray(patch)) return patch;
  if (typeof base !== "object" || base === null) return patch;
  if (typeof patch !== "object" || patch === null) return patch;

  const out: any = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    out[k] = k in out ? deepMerge(out[k], v) : v;
  }
  return out;
}

export async function POST(request: Request) {
  const { token, answersPatch } = (await request.json()) as { token?: string; answersPatch?: any };
  if (!token) return new NextResponse("Missing token", { status: 400 });
  if (!answersPatch) return new NextResponse("Missing answersPatch", { status: 400 });

  const supabase = createSupabaseServiceClient();

  const { data: existing, error: loadError } = await supabase.from("candidate_assessments").select("*").eq("token", token).single();
  if (loadError) return new NextResponse("Invalid link", { status: 404 });
  if (existing.status === "submitted") return new NextResponse("Already submitted", { status: 409 });

  const mergedAnswers = deepMerge(existing.answers ?? {}, answersPatch);
  const { error: updateError } = await supabase.from("candidate_assessments").update({ answers: mergedAnswers }).eq("token", token);
  if (updateError) return new NextResponse(updateError.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
