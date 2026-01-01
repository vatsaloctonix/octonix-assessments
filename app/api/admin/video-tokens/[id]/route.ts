import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

// Generate random password (6 alphanumeric characters)
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding ambiguous characters
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();

  // Get assessment data
  const { data: item, error } = await supabase.from("candidate_assessments").select("*").eq("id", id).single();
  if (error) return new NextResponse(error.message, { status: 500 });

  const recordings: Array<{ questionIndex: number; storagePath: string; durationSec: number }> = (item.answers?.video?.recordings ?? []) as any;

  // Generate tokens for each video
  const tokens: Array<{ questionIndex: number; tokenId: string; password: string; expiresAt: string }> = [];

  for (const recording of recordings) {
    const password = generatePassword();
    // Expiry time = video duration × 15 minutes
    const expiryMinutes = recording.durationSec * 15;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    const { data: tokenData, error: tokenError } = await supabase
      .from("video_access_tokens")
      .insert({
        assessment_id: id,
        question_index: recording.questionIndex,
        storage_path: recording.storagePath,
        password: password,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Error creating token:", tokenError);
      continue;
    }

    tokens.push({
      questionIndex: recording.questionIndex,
      tokenId: tokenData.id,
      password: password,
      expiresAt: expiresAt.toISOString(),
    });
  }

  return NextResponse.json({ tokens });
}
