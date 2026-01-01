"use client";

import { useEffect, useState } from "react";
import { Card, Button, Divider, Muted } from "@/components/ui";
import type { StoredAssessment } from "@/lib/types";
import { ROLE_MARKET, DOMAIN_QUESTIONS, CODING_PROBLEMS, VIDEO_QUESTIONS } from "@/lib/assessmentConfig";

function safeJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export default function AdminSubmissionClient(props: { id: string }) {
  const [item, setItem] = useState<StoredAssessment | null>(null);
  const [videoLinks, setVideoLinks] = useState<Array<{ questionIndex: number; url: string }>>([]);
  const [videoTokens, setVideoTokens] = useState<Array<{ questionIndex: number; tokenId: string; password: string; expiresAt: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [groqState, setGroqState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [tokensGenerating, setTokensGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["step1", "step2", "step3", "videos", "ai"]));

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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const exportPDF = () => {
    if (!item) return;

    // Save current state
    const previousSections = new Set(expandedSections);

    // Expand all sections for export
    const allSections = new Set(["step1", "step2", "step3", "step4", "step4coding", "videos", "proctoring", "ai"]);
    setExpandedSections(allSections);

    // Wait for DOM to fully render all sections (increased timeout for reliability)
    setTimeout(() => {
      window.print();

      // Restore previous state after print dialog closes
      const restoreState = () => {
        setExpandedSections(previousSections);
        window.removeEventListener("afterprint", restoreState);
      };
      window.addEventListener("afterprint", restoreState);
    }, 400);
  };

  const generateVideoTokens = async () => {
    if (!item) return;
    setTokensGenerating(true);
    try {
      const res = await fetch(`/api/admin/video-tokens/${item.id}`, { method: "POST" });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setVideoTokens(data.tokens ?? []);
    } catch (error) {
      console.error("Failed to generate video tokens:", error);
      alert("Failed to generate video access links. Please try again.");
    } finally {
      setTokensGenerating(false);
    }
  };

  if (loading) {
    return (
      <Card title="Submission">
        <div className="text-sm">Loading...</div>
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
  const roleLabel = selectedRoleId ? (ROLE_MARKET.find((r) => r.roleId === selectedRoleId)?.label ?? selectedRoleId) : "-";
  const roleInfo = selectedRoleId ? ROLE_MARKET.find((r) => r.roleId === selectedRoleId) : undefined;
  const domainQuestions = selectedRoleId ? DOMAIN_QUESTIONS[selectedRoleId] : [];
  const codingLanguage = roleInfo?.codingLanguage;
  const codingProblems = codingLanguage ? CODING_PROBLEMS[codingLanguage] : [];

  return (
    <div className="space-y-4">
      <Card
        title={item.admin_label ?? "Candidate"}
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => (window.location.href = "/admin")}>
              Back
            </Button>
            <Button variant="ghost" onClick={exportPDF}>
              Export PDF
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
              {groqState === "running" ? "Scoring..." : "Run AI scoring"}
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
          <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            <div className="font-medium mb-1">Hmm, having trouble connecting to our AI assistant</div>
            <div className="text-orange-700">
              Our AI scoring service is temporarily unavailable. This usually resolves quickly. Feel free to try again in a moment, or continue reviewing other sections manually.
            </div>
          </div>
        )}

        {Boolean((item.ai_evaluations as any)?.overall) && expandedSections.has("ai") && (
          <div className="mt-4 rounded-2xl border border-black/10 p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">AI Evaluation</div>
              <button onClick={() => toggleSection("ai")} className="text-xs text-black/50 hover:text-black">
                Collapse
              </button>
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-2 text-sm">
              <div className="rounded-xl border border-black/10 px-3 py-2">
                <div className="text-[12px] text-black/60">Overall Score</div>
                <div className="text-lg font-semibold">{(item.ai_evaluations as any).overall.overallScore0to100}/100</div>
              </div>
              <div className="rounded-xl border border-black/10 px-3 py-2">
                <div className="text-[12px] text-black/60">Integrity Risk</div>
                <div className="text-lg font-semibold">{(item.ai_evaluations as any).overall.sectionScores.integrityRisk0to10}/10</div>
              </div>
            </div>
            <Divider />
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div>
                <div className="text-[12px] font-medium text-black/70">Strengths</div>
                <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                  {((item.ai_evaluations as any).overall.strengths ?? []).map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[12px] font-medium text-black/70">Risks</div>
                <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                  {((item.ai_evaluations as any).overall.risks ?? []).map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-[12px] font-medium text-black/70">Next Steps</div>
                <ul className="mt-1 list-disc pl-4 text-[12px] text-black/70">
                  {((item.ai_evaluations as any).overall.recommendedNextSteps ?? []).map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
            <Divider />
            <div className="text-[12px] text-black/70">{(item.ai_evaluations as any).overall.shortSummary}</div>
          </div>
        )}

        {Boolean((item.ai_evaluations as any)?.overall) && !expandedSections.has("ai") && (
          <div className="mt-4">
            <button onClick={() => toggleSection("ai")} className="text-sm text-black/60 hover:text-black">
              + Show AI Evaluation
            </button>
          </div>
        )}
      </Card>

      {/* Step 1: Personality & Availability */}
      <Card title="Step 1: Personality & Availability">
        <button
          onClick={() => toggleSection("step1")}
          className="mb-3 text-sm text-black/60 hover:text-black"
        >
          {expandedSections.has("step1") ? "- Collapse" : "+ Expand"}
        </button>

        {expandedSections.has("step1") && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[12px] font-medium text-black/60">Hobbies</div>
              <div className="mt-1">
                {(() => {
                  const hobbies = item.answers?.personality?.hobbies;
                  if (Array.isArray(hobbies)) {
                    return (
                      <div className="flex flex-wrap gap-2">
                        {hobbies.map((h, i) => (
                          <span key={i} className="rounded-lg bg-black/5 px-2 py-1 text-xs">
                            {h}
                          </span>
                        ))}
                      </div>
                    );
                  }
                  return <div className="text-black/70">{hobbies || "-"}</div>;
                })()}
              </div>
            </div>

            <Divider />

            <div>
              <div className="text-[12px] font-medium text-black/60">Daily Availability for Training</div>
              <div className="mt-1 text-black/70">
                {(() => {
                  const avail = item.answers?.personality?.dailyAvailability;
                  if (typeof avail === "object" && avail !== null && "timezone" in avail) {
                    return (
                      <div className="space-y-2">
                        <div>
                          <strong>Timezone:</strong> {avail.timezone}
                        </div>
                        {avail.schedule && avail.schedule.length > 0 && (
                          <div>
                            <strong>Schedule:</strong>
                            {avail.schedule.map((slot: any, i: number) => (
                              <div key={i} className="ml-4 mt-1 rounded-lg border border-black/10 bg-black/5 p-2 text-xs">
                                <div>
                                  <strong>Days:</strong> {slot.days.join(", ")}
                                </div>
                                <div>
                                  <strong>Time:</strong>{" "}
                                  {slot.ranges && slot.ranges[0]
                                    ? `${slot.ranges[0].start} - ${slot.ranges[0].end}`
                                    : "-"}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }
                  return <div>{String(avail) || "-"}</div>;
                })()}
              </div>
            </div>

            <Divider />

            <div>
              <div className="text-[12px] font-medium text-black/60">Pressure Handling Notes</div>
              <div className="mt-1 text-black/70">{item.answers?.personality?.pressureNotes || "-"}</div>
            </div>

            <Divider />

            <div>
              <div className="text-[12px] font-medium text-black/60">Honesty Commitment</div>
              <div className="mt-1 text-black/70">
                {item.answers?.personality?.honestyCommitment ? "Yes" : "No"}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Step 2: AI Usage */}
      <Card title="Step 2: AI Usage & Prompting">
        <button
          onClick={() => toggleSection("step2")}
          className="mb-3 text-sm text-black/60 hover:text-black"
        >
          {expandedSections.has("step2") ? "- Collapse" : "+ Expand"}
        </button>

        {expandedSections.has("step2") && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-[12px] font-medium text-black/60">
                Prompt Task 1: Write a prompt that will draft a small reschedule interview email
              </div>
              <div className="mt-1 rounded-lg border border-black/10 bg-black/5 p-3 text-xs text-black/70">
                {item.answers?.aiUsage?.promptTask1 || "-"}
              </div>
            </div>

            <Divider />

            <div>
              <div className="text-[12px] font-medium text-black/60">
                Prompt Task 2: Make a prompt that will write an essay on YouTube in most humanized way
              </div>
              <div className="mt-1 rounded-lg border border-black/10 bg-black/5 p-3 text-xs text-black/70">
                {item.answers?.aiUsage?.promptTask2 || "-"}
              </div>
            </div>

            <Divider />

            <div>
              <div className="text-[12px] font-medium text-black/60">
                Prompt Task 3: Pick any daily problem you are facing, write a prompt and make AI solve it
              </div>
              <div className="mt-1 rounded-lg border border-black/10 bg-black/5 p-3 text-xs text-black/70">
                {item.answers?.aiUsage?.promptTask3 || "-"}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Step 3: Domain Selection */}
      <Card title="Step 3: Domain Selection">
        <button
          onClick={() => toggleSection("step3")}
          className="mb-3 text-sm text-black/60 hover:text-black"
        >
          {expandedSections.has("step3") ? "- Collapse" : "+ Expand"}
        </button>

        {expandedSections.has("step3") && (
          <div className="text-sm">
            <div className="text-[12px] font-medium text-black/60">Selected Role</div>
            <div className="mt-1 rounded-lg border border-black/10 bg-black/5 px-3 py-2 font-medium">
              {roleLabel}
            </div>
          </div>
        )}
      </Card>

      {/* Step 4: Domain Knowledge */}
      {domainQuestions.length > 0 && (
        <Card title="Step 4: Domain Knowledge">
          <button
            onClick={() => toggleSection("step4")}
            className="mb-3 text-sm text-black/60 hover:text-black"
          >
            {expandedSections.has("step4") ? "- Collapse" : "+ Expand"}
          </button>

          {expandedSections.has("step4") && (
            <div className="space-y-3">
              {domainQuestions.map((q, index) => {
                const answer = item.answers?.domainKnowledge?.answersByQuestionId?.[q.id];
                const isCorrect = q.kind === "mcq" && q.correctAnswer && answer === q.correctAnswer;
                const isWrong = q.kind === "mcq" && q.correctAnswer && answer && answer !== q.correctAnswer;

                return (
                  <div key={q.id} className="rounded-lg border border-black/10 p-3">
                    <div className="text-[12px] font-medium text-black/60">
                      Q{index + 1} ({q.kind === "mcq" ? "Multiple Choice" : "Text"})
                    </div>
                    <div className="mt-1 text-sm font-medium">{q.prompt}</div>
                    {q.kind === "mcq" && q.options && (
                      <div className="mt-2 space-y-1">
                        {q.options.map((opt, i) => {
                          const isThisCorrectAnswer = opt === q.correctAnswer;
                          const isThisCandidateAnswer = answer === opt;

                          return (
                            <div
                              key={i}
                              className={[
                                "rounded-lg border px-2 py-1 text-xs",
                                isThisCandidateAnswer && isCorrect
                                  ? "border-green-300 bg-green-50 font-medium text-green-700"
                                  : isThisCandidateAnswer && isWrong
                                  ? "border-red-300 bg-red-50 font-medium text-red-700"
                                  : isThisCorrectAnswer && isWrong
                                  ? "border-green-300 bg-green-50 font-medium text-green-700"
                                  : "border-black/10 text-black/50",
                              ].join(" ")}
                            >
                              {isThisCorrectAnswer && isWrong && !isThisCandidateAnswer && (
                                <span className="mr-1">✓</span>
                              )}
                              {isThisCandidateAnswer && isWrong && (
                                <span className="mr-1">✗</span>
                              )}
                              {opt}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {q.kind === "text" && (
                      <div className="mt-2 rounded-lg border border-black/10 bg-black/5 p-2 text-xs text-black/70">
                        {answer || "-"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Step 4 (continued): Coding Problems */}
      {codingProblems.length > 0 && (
        <Card title="Step 4 (continued): Coding Problems">
          <button
            onClick={() => toggleSection("step4coding")}
            className="mb-3 text-sm text-black/60 hover:text-black"
          >
            {expandedSections.has("step4coding") ? "- Collapse" : "+ Expand"}
          </button>

          {expandedSections.has("step4coding") && (
            <div className="space-y-4">
              {codingProblems.map((problem, index) => {
                const existingProblem = item.answers?.domainKnowledge?.coding?.problems?.find((p) => p.problemId === problem.id);
                const answer = existingProblem?.code;
                return (
                  <div key={problem.id} className="rounded-lg border border-black/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">
                        Problem {index + 1}: {problem.title}
                      </div>
                      <div
                        className={[
                          "rounded px-2 py-1 text-[11px] font-medium",
                          problem.difficulty === "easy"
                            ? "bg-green-50 text-green-700"
                            : problem.difficulty === "medium"
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700",
                        ].join(" ")}
                      >
                        {problem.difficulty}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-black/70">{problem.prompt}</div>
                    <div className="mt-3">
                      <div className="text-[12px] font-medium text-black/60">Candidate's Solution:</div>
                      <pre className="mt-1 overflow-auto rounded-lg border border-black/10 bg-black/5 p-3 text-[11px] leading-snug">
                        {answer || "(No solution provided)"}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* Step 5: Video Interview */}
      <Card title="Step 5: Video Interview">
        <button
          onClick={() => toggleSection("videos")}
          className="mb-3 text-sm text-black/60 hover:text-black"
        >
          {expandedSections.has("videos") ? "- Collapse" : "+ Expand"}
        </button>

        {expandedSections.has("videos") && (
          <div className="space-y-4">
            {videoLinks.length === 0 && <Muted>No uploaded videos.</Muted>}
            {videoLinks.map((v) => (
              <div key={v.questionIndex} className="rounded-2xl border border-black/10 p-4">
                <div className="text-sm font-semibold">Question {v.questionIndex + 1} of 5</div>
                <div className="mt-1 text-xs text-black/60">{VIDEO_QUESTIONS[v.questionIndex]}</div>
                <video controls className="mt-3 w-full rounded-xl border border-black/10" src={v.url} />
              </div>
            ))}

            {/* One-time Video Access Links for PDF Export */}
            {videoLinks.length > 0 && (
              <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 print-block">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-blue-900">One-Time Video Access Links</div>
                    <div className="mt-1 text-xs text-blue-700">
                      Generate password-protected links for PDF export. Each link expires after viewing.
                    </div>
                  </div>
                  <Button
                    onClick={generateVideoTokens}
                    disabled={tokensGenerating}
                    className="print-hidden"
                  >
                    {tokensGenerating ? "Generating..." : videoTokens.length > 0 ? "Regenerate Links" : "Generate Links"}
                  </Button>
                </div>

                {videoTokens.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {videoTokens.map((token) => {
                      const videoUrl = `${window.location.origin}/video-access/${token.tokenId}`;
                      const expiryDate = new Date(token.expiresAt);
                      return (
                        <div key={token.questionIndex} className="rounded-xl border border-blue-300 bg-white p-3">
                          <div className="text-sm font-medium text-blue-900">
                            Question {token.questionIndex + 1} Video Access
                          </div>
                          <div className="mt-2 space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-black/60">Link:</span>
                              <code className="flex-1 rounded bg-black/5 px-2 py-1 text-[10px]">{videoUrl}</code>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-black/60">Password:</span>
                              <code className="rounded bg-green-100 px-2 py-1 font-bold text-green-900">{token.password}</code>
                            </div>
                            <div className="text-black/50">
                              Expires: {expiryDate.toLocaleString()} (one-time use)
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Proctoring Signals */}
      <Card title="Proctoring Signals">
        <button
          onClick={() => toggleSection("proctoring")}
          className="mb-3 text-sm text-black/60 hover:text-black"
        >
          {expandedSections.has("proctoring") ? "- Collapse" : "+ Expand"}
        </button>

        {expandedSections.has("proctoring") && (
          <div>
            <div className="grid gap-3 md:grid-cols-3 text-sm">
              <div className="rounded-lg border border-black/10 p-3">
                <div className="text-[12px] text-black/60">Tab Switches</div>
                <div className="text-2xl font-semibold">{(item.proctoring as any)?.counts?.tabSwitch ?? 0}</div>
              </div>
              <div className="rounded-lg border border-black/10 p-3">
                <div className="text-[12px] text-black/60">Copy Attempts</div>
                <div className="text-2xl font-semibold">{(item.proctoring as any)?.counts?.copyAttempt ?? 0}</div>
              </div>
              <div className="rounded-lg border border-black/10 p-3">
                <div className="text-[12px] text-black/60">Paste Attempts</div>
                <div className="text-2xl font-semibold">{(item.proctoring as any)?.counts?.pasteAttempt ?? 0}</div>
              </div>
            </div>
            <Divider />
            <details className="text-xs">
              <summary className="cursor-pointer text-black/60 hover:text-black">
                Show raw event log (last 200 events)
              </summary>
              <pre className="mt-2 overflow-auto rounded-2xl border border-black/10 bg-white p-4 text-[11px] leading-snug">
                {safeJson((item.proctoring as any)?.events?.slice(-200) ?? [])}
              </pre>
            </details>
          </div>
        )}
      </Card>

      {/* Raw Data (collapsed by default) */}
      <Card title="Raw Data (JSON)">
        <details className="text-xs">
          <summary className="cursor-pointer text-black/60 hover:text-black">
            Show complete raw answers
          </summary>
          <pre className="mt-2 overflow-auto rounded-2xl border border-black/10 bg-white p-4 text-[11px] leading-snug">
            {safeJson(item.answers)}
          </pre>
        </details>
      </Card>
    </div>
  );
}
