import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

function randomToken(length: number) {
  const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export async function POST(request: Request) {
  const { adminLabel } = (await request.json()) as { adminLabel: string | null };

  const supabase = createSupabaseServiceClient();
  const token = randomToken(24);

  const { data, error } = await supabase
    .from("candidate_assessments")
    .insert({
      token,
      admin_label: adminLabel ?? null,
      status: "in_progress",
      answers: {},
      proctoring: { counts: {}, events: [] },
      videos: {},
      ai_evaluations: {},
    })
    .select("*")
    .single();

  if (error) return new NextResponse(error.message, { status: 500 });

  const origin = new URL(request.url).origin;
  return NextResponse.json({ ok: true, token: data.token, url: `${origin}/apply/${data.token}` });
}
