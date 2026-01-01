import { NextResponse } from "next/server";
import { createSupabaseServiceClient, STORAGE_BUCKET } from "@/lib/supabaseServer";

/**
 * Cleanup expired video access tokens and delete their associated videos from storage
 * This endpoint can be called manually or set up as a cron job
 */
export async function POST() {
  const supabase = createSupabaseServiceClient();

  try {
    // Find all expired tokens
    const now = new Date().toISOString();
    const { data: expiredTokens, error: fetchError } = await supabase
      .from("video_access_tokens")
      .select("*")
      .lt("expires_at", now);

    if (fetchError) {
      console.error("Error fetching expired tokens:", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    if (!expiredTokens || expiredTokens.length === 0) {
      return NextResponse.json({
        message: "No expired videos to clean up",
        deleted: 0,
      });
    }

    // Group tokens by storage path to avoid duplicate deletions
    const uniqueStoragePaths = new Set(expiredTokens.map((t) => t.storage_path));
    const deletedPaths: string[] = [];
    const failedPaths: Array<{ path: string; error: string }> = [];

    // Delete videos from storage
    for (const storagePath of uniqueStoragePaths) {
      try {
        const { error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([storagePath]);

        if (deleteError) {
          console.error(`Failed to delete ${storagePath}:`, deleteError);
          failedPaths.push({ path: storagePath, error: deleteError.message });
        } else {
          deletedPaths.push(storagePath);
        }
      } catch (err) {
        console.error(`Error deleting ${storagePath}:`, err);
        failedPaths.push({
          path: storagePath,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Delete the expired tokens from database
    const { error: tokenDeleteError } = await supabase
      .from("video_access_tokens")
      .delete()
      .lt("expires_at", now);

    if (tokenDeleteError) {
      console.error("Error deleting expired tokens:", tokenDeleteError);
    }

    return NextResponse.json({
      message: "Cleanup completed",
      expiredTokens: expiredTokens.length,
      videosDeleted: deletedPaths.length,
      videosFailed: failedPaths.length,
      deletedPaths,
      failedPaths,
    });
  } catch (error) {
    console.error("Cleanup error:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check how many videos are expired and ready for cleanup
 */
export async function GET() {
  const supabase = createSupabaseServiceClient();

  try {
    const now = new Date().toISOString();
    const { data: expiredTokens, error } = await supabase
      .from("video_access_tokens")
      .select("storage_path, expires_at")
      .lt("expires_at", now);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const uniqueVideos = new Set(expiredTokens?.map((t) => t.storage_path) ?? []);

    return NextResponse.json({
      expiredTokenCount: expiredTokens?.length ?? 0,
      uniqueVideosToDelete: uniqueVideos.size,
      tokens: expiredTokens ?? [],
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to check expired videos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
