import { NextResponse } from "next/server";
import { createSupabaseServiceClient, STORAGE_BUCKET } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  const supabase = createSupabaseServiceClient();

  try {
    const body = await req.json();
    const ids = body.ids as string[];

    if (!Array.isArray(ids) || ids.length === 0) {
      return new NextResponse("Invalid request: ids array required", { status: 400 });
    }

    // Fetch all items to get video storage paths
    const { data: items, error: fetchError } = await supabase
      .from("candidate_assessments")
      .select("*")
      .in("id", ids);

    if (fetchError) {
      return new NextResponse(fetchError.message, { status: 500 });
    }

    // Collect all video storage paths
    const storagePaths: string[] = [];
    for (const item of items ?? []) {
      const recordings: Array<{ questionIndex: number; storagePath: string }> = (item.answers?.video?.recordings ?? []) as any;
      for (const r of recordings) {
        if (r.storagePath) {
          storagePaths.push(r.storagePath);
        }
      }
    }

    // Delete videos from storage (if any)
    if (storagePaths.length > 0) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(storagePaths);
      if (storageError) {
        console.error("Storage deletion error:", storageError);
        // Continue anyway - don't fail the whole operation
      }
    }

    // Delete database rows
    const { error: deleteError } = await supabase
      .from("candidate_assessments")
      .delete()
      .in("id", ids);

    if (deleteError) {
      return new NextResponse(deleteError.message, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error) {
    return new NextResponse(error instanceof Error ? error.message : "Unknown error", { status: 500 });
  }
}
