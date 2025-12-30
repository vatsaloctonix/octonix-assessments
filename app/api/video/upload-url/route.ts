import { NextResponse } from "next/server";
import { createSupabaseServiceClient, STORAGE_BUCKET } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const { token, questionIndex } = (await request.json()) as { token?: string; questionIndex?: number };
  if (!token) return new NextResponse("Missing token", { status: 400 });
  if (typeof questionIndex !== "number") return new NextResponse("Missing questionIndex", { status: 400 });

  const supabase = createSupabaseServiceClient();

  const { data: existing, error: loadError } = await supabase.from("candidate_assessments").select("id,status").eq("token", token).single();
  if (loadError) return new NextResponse("Invalid link", { status: 404 });
  if (existing.status === "submitted") return new NextResponse("Already submitted", { status: 409 });

  const safeIndex = Math.max(0, Math.min(4, questionIndex));
  const storagePath = `videos/${existing.id}/q${safeIndex + 1}-${Date.now()}.webm`;

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUploadUrl(storagePath);
  if (error || !data) return new NextResponse(error?.message ?? "Failed to create upload url", { status: 500 });

  return NextResponse.json({ signedUrl: data.signedUrl, storagePath });
}
