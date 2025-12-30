import { NextResponse } from "next/server";
import { createSupabaseServiceClient, STORAGE_BUCKET } from "@/lib/supabaseServer";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = createSupabaseServiceClient();

  const { data: item, error } = await supabase.from("candidate_assessments").select("*").eq("id", id).single();
  if (error) return new NextResponse(error.message, { status: 500 });

  const recordings: Array<{ questionIndex: number; storagePath: string }> = (item.answers?.video?.recordings ?? []) as any;

  const videoLinks: Array<{ questionIndex: number; url: string }> = [];
  for (const r of recordings) {
    const { data, error: urlError } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(r.storagePath, 60 * 60);
    if (!urlError && data?.signedUrl) videoLinks.push({ questionIndex: r.questionIndex, url: data.signedUrl });
  }

  return NextResponse.json({ item, videoLinks });
}
