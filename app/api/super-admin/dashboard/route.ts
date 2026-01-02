import { NextResponse } from "next/server";
import { getSessionFromCookie, requireSuperAdmin } from "@/lib/auth";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

// GET /api/super-admin/dashboard - Get dashboard stats and assessments sorted by score
export async function GET(request: Request) {
  try {
    const sessionData = await getSessionFromCookie();
    requireSuperAdmin(sessionData?.admin || null);

    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sortBy") || "recent"; // recent, high_score, low_score, submitted
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const supabase = createSupabaseServiceClient();

    // Get all assessments with admin/trainer info
    let query = supabase
      .from("candidate_assessments")
      .select(`
        *,
        creator:created_by_trainer_id(id, name, email)
      `)
      .range(offset, offset + limit - 1);

    // Apply sorting
    switch (sortBy) {
      case "high_score":
        // Sort by AI overall score descending (high to low)
        // Note: JSONB sorting is complex, we'll fetch and sort in memory
        break;
      case "low_score":
        // Sort by AI overall score ascending (low to high)
        break;
      case "submitted":
        query = query
          .eq("status", "submitted")
          .order("submitted_at", { ascending: false });
        break;
      case "recent":
      default:
        query = query.order("created_at", { ascending: false });
        break;
    }

    const { data: assessments, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // For score-based sorting, sort in memory
    let sortedAssessments = assessments || [];
    if (sortBy === "high_score" || sortBy === "low_score") {
      sortedAssessments = sortedAssessments
        .map((a) => ({
          ...a,
          score: (a.ai_evaluations as any)?.overall?.overallScore0to100 || 0,
        }))
        .sort((a, b) => {
          if (sortBy === "high_score") {
            return b.score - a.score;
          } else {
            return a.score - b.score;
          }
        });
    }

    // Get stats
    const { data: allAssessments } = await supabase
      .from("candidate_assessments")
      .select("id, status, ai_evaluations");

    const stats = {
      total: allAssessments?.length || 0,
      submitted: allAssessments?.filter((a) => a.status === "submitted").length || 0,
      in_progress: allAssessments?.filter((a) => a.status === "in_progress").length || 0,
      evaluated: allAssessments?.filter((a) => (a.ai_evaluations as any)?.overall).length || 0,
    };

    return NextResponse.json({
      assessments: sortedAssessments,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: sortedAssessments.length === limit,
      },
    });
  } catch (error: any) {
    if (error.message.includes("Unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Get dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
