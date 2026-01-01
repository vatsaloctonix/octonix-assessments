import { NextResponse } from "next/server";
import { createSupabaseServiceClient, STORAGE_BUCKET } from "@/lib/supabaseServer";

export async function POST(request: Request, context: { params: Promise<{ tokenId: string }> }) {
  const { tokenId } = await context.params;
  const { password } = (await request.json()) as { password?: string };

  if (!password) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();

  // Get the token
  const { data: token, error: tokenError } = await supabase
    .from("video_access_tokens")
    .select("*")
    .eq("id", tokenId)
    .single();

  if (tokenError || !token) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });
  }

  // Check if password matches
  if (token.password !== password) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Check if expired
  const now = new Date();
  const expiresAt = new Date(token.expires_at);
  if (now > expiresAt) {
    return NextResponse.json({ error: "This link has expired" }, { status: 410 });
  }

  // Check if already used
  if (token.is_used) {
    return NextResponse.json({ error: "This link has already been used" }, { status: 410 });
  }

  // Mark as used
  await supabase
    .from("video_access_tokens")
    .update({ is_used: true, accessed_at: new Date().toISOString() })
    .eq("id", tokenId);

  // Generate signed URL (valid for 24 hours)
  const { data: urlData, error: urlError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(token.storage_path, 24 * 60 * 60);

  if (urlError || !urlData?.signedUrl) {
    return NextResponse.json({ error: "Failed to generate video URL" }, { status: 500 });
  }

  return NextResponse.json({
    videoUrl: urlData.signedUrl,
    questionIndex: token.question_index
  });
}
