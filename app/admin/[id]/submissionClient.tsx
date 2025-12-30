  "use client";

  import { useEffect, useState } from "react";
  import { Card, Button, Divider, Muted } from "@/components/ui";
  import type { StoredAssessment } from "@/lib/types";
  import { ROLE_MARKET } from "@/lib/assessmentConfig";

  function safeJson(value: unknown) {
    return JSON.stringify(value, null, 2);
  }

  export default function AdminSubmissionClient(props: { id: string }) {
    const [item, setItem] = useState<StoredAssessment | null>(null);
    const [videoLinks, setVideoLinks] = useState<Array<{ questionIndex: number; url: string }>>([]);
    const [loading, setLoading] = useState(true);
    const [groqState, setGroqState] = useState<"idle" | "running" | "done" | "error">("idle");

    async function load() {
      setLoading(true);
      const res = await fetch(`/api/admin/submissions/${props.id}`);
      const data = await res.json();
      setItem(data.item ?? null);
      setVideoLinks(data.videoLinks ?? []);
      setLoading(false);
    }

    useEffect(() => {
      void load();
    }, [props.id]);

    if (loading) {
      return (
        <Card title="Submission">
          <div className="text-sm">Loading…</div>
        </Card>
      );
    }

    if (!item) {
      return (
        <Card title="Submission">
          <div className="text-sm">Not found.</div>
        </Card>
      );
    }

    const selectedRoleId = item.answers?.domain?.selectedRoleId;
    const roleLabel = selectedRoleId ? (ROLE_MARKET.find((r) => r.roleId === selectedRoleId)?.label ?? selectedRoleId) : "—";

    return (
      <div className="space-y-4">
        <Card
          title={item.admin_label ?? "Candidate"}
          right={
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => (window.location.href = "/admin")}>
                Back
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  window.location.href = `/api/admin/download/${item.id}`;
                }}
              >
                Download JSON
              </Button>
              <Button
                onClick={async () => {
                  setGroqState("running");
                  try {
                    const res = await fetch(`/api/admin/run-ai-score/${item.id}`, { method: "POST" });
                    if (!res.ok) throw new Error(await res.text());
                    setGroqState("done");
                    await load();
                  } catch {
                    setGroqState("error");
                  }
                }}
                disabled={groqState === "running"}
              >
                {groqState === "running" ? "Scoring…" : "Run AI scoring"}
              </Button>
            </div>
          }
        >
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <div>
              <div className="text-black/60 text-[12px]">Role</div>
              <div className="font-medium">{roleLabel}</div>
            </div>
            <div>
              <div className="text-black/60 text-[12px]">Status</div>
              <div className="font-medium">{item.status}</div>
            </div>
          </div>

          {groqState === "error" && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              AI scoring failed. Check GROQ_API_KEY and GROQ_MODEL env vars.
            </div>
          )}

          {Boolean((item.ai_evaluations as any)?.overall) && (
            <div className="mt-4 rounded-2xl border border-black/10 p-4">
              <div className="text-sm font-semibold">AI Evaluation</div>
              <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
                <div className="rounded-xl border border-black/10 px-3 py-2">
                  <div className="text-[12px] text-black/60">Overall</div>
                  <div className="text-lg font-semibold">{(item.ai_evaluations as any).overall.overallScore0to100}/100</div>
                </div>
                <div className="rounded-xl border border-black/10 px-3 py-2">
                  <div className="text-[12px] text-black/60">Integrity risk</div>
                  <div className="text-lg font-semibold">{(item.ai_evaluations as any).overall.sectionScores.integrityRisk0to10}/10</div>
                </div>
              </div>
              <Divider />
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div>
                  <div className="text-[12px] font-medium text-black/70">Strengths</div>
                  <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                    {((item.ai_evaluations as any).overall.strengths ?? []).map((s: string) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[12px] font-medium text-black/70">Risks</div>
                  <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                    {((item.ai_evaluations as any).overall.risks ?? []).map((s: string) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-[12px] font-medium text-black/70">Next steps</div>
                  <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                    {((item.ai_evaluations as any).overall.recommendedNextSteps ?? []).map((s: string) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <Divider />
              <div className="text-[12px] text-black/70">{(item.ai_evaluations as any).overall.shortSummary}</div>
            </div>
          )}
        </Card>

        <Card title="Videos">
          <div className="space-y-4">
            {videoLinks.length === 0 && <Muted>No uploaded videos.</Muted>}
            {videoLinks.map((v) => (
              <div key={v.questionIndex} className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold">Q{v.questionIndex + 1}</div>
                <video controls className="mt-3 w-full rounded-xl border border-black/10" src={v.url} />
              </div>
            ))}
          </div>
        </Card>

        <Card title="Proctoring signals">
          <div className="text-[12px] text-black/70">Counts: {safeJson((item.proctoring as any)?.counts ?? {})}</div>
          <Divider />
          <pre className="overflow-auto rounded-2xl border border-black/10 bg-white p-4 text-[11px] leading-snug">
{safeJson((item.proctoring as any)?.events?.slice(-200) ?? [])}
          </pre>
          <Muted>Last 200 events shown. Full data is in downloaded JSON.</Muted>
        </Card>

        <Card title="Answers (raw)">
          <pre className="overflow-auto rounded-2xl border border-black/10 bg-white p-4 text-[11px] leading-snug">
{safeJson(item.answers)}
          </pre>
        </Card>
      </div>
    );
  }
