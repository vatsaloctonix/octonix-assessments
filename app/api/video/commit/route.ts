import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const { token, questionIndex, storagePath, durationSec, sizeBytes, createdAtIso } = (await request.json()) as {
    token?: string;
    questionIndex?: number;
    storagePath?: string;
    durationSec?: number;
    sizeBytes?: number;
    createdAtIso?: string;
  };

  if (!token) return new NextResponse("Missing token", { status: 400 });
  if (typeof questionIndex !== "number") return new NextResponse("Missing questionIndex", { status: 400 });
  if (!storagePath) return new NextResponse("Missing storagePath", { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data: existing, error: loadError } = await supabase.from("candidate_assessments").select("*").eq("token", token).single();
  if (loadError) return new NextResponse("Invalid link", { status: 404 });
  if (existing.status === "submitted") return new NextResponse("Already submitted", { status: 409 });

  const answers = existing.answers ?? {};
  const existingRecordings = (answers.video?.recordings ?? []) as any[];
  const nextRecordings = existingRecordings.filter((r) => r.questionIndex !== questionIndex);
  nextRecordings.push({
    questionIndex,
    storagePath,
    durationSec: durationSec ?? 0,
    sizeBytes: sizeBytes ?? 0,
    createdAtIso: createdAtIso ?? new Date().toISOString(),
  });

  const nextAnswers = { ...answers, video: { ...(answers.video ?? {}), recordings: nextRecordings } };
  const { error: updateError } = await supabase.from("candidate_assessments").update({ answers: nextAnswers }).eq("token", token);
  if (updateError) return new NextResponse(updateError.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
