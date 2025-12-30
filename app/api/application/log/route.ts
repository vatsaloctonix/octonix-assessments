import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabaseServer";

function incrementCounts(counts: Record<string, number>, type: string) {
  counts[type] = (counts[type] ?? 0) + 1;
}

export async function POST(request: Request) {
  const { token, events } = (await request.json()) as { token?: string; events?: Array<{ type: string; details?: Record<string, unknown> }> };
  if (!token) return new NextResponse("Missing token", { status: 400 });
  if (!events || !Array.isArray(events)) return new NextResponse("Missing events", { status: 400 });

  const supabase = createSupabaseServiceClient();
  const { data: existing, error: loadError } = await supabase.from("candidate_assessments").select("*").eq("token", token).single();
  if (loadError) return new NextResponse("Invalid link", { status: 404 });

  const proctoring = existing.proctoring ?? { counts: {}, events: [] };
  const counts = proctoring.counts ?? {};
  const existingEvents = proctoring.events ?? [];

  for (const e of events) {
    incrementCounts(counts, e.type);
    existingEvents.push({ atIso: new Date().toISOString(), type: e.type, details: e.details ?? {} });
  }

  const trimmedEvents = existingEvents.slice(-4000);
  const { error: updateError } = await supabase.from("candidate_assessments").update({ proctoring: { counts, events: trimmedEvents } }).eq("token", token);
  if (updateError) return new NextResponse(updateError.message, { status: 500 });

  return NextResponse.json({ ok: true });
}
