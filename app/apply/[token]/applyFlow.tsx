"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Divider, Input, Muted, Select, Textarea, TinyLabel } from "@/components/ui";
import { CODING_PROBLEMS, DOMAIN_QUESTIONS, ROLE_MARKET, VIDEO_QUESTIONS, type RoleId } from "@/lib/assessmentConfig";
import type { AllAnswers, StoredAssessment } from "@/lib/types";
import { z } from "zod";
import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";

const StepNames = [
  "1. Personality",
  "2. AI Usage",
  "3. Domain",
  "4. Domain Basics + Coding",
  "5. Video",
] as const;

type SaveState = "idle" | "saving" | "saved" | "error";

const LoadResponseSchema = z.object({
  ok: z.literal(true),
  assessment: z.any(),
});

function roleLabelFromId(roleId: RoleId | undefined): string | null {
  if (!roleId) return null;
  return ROLE_MARKET.find((r) => r.roleId === roleId)?.label ?? null;
}

function pickCodingLanguage(roleId: RoleId | undefined): "python" | "java" | null {
  if (!roleId) return null;
  return ROLE_MARKET.find((r) => r.roleId === roleId)?.codingLanguage ?? null;
}

function shouldShowCoding(roleId: RoleId | undefined): boolean {
  return roleId === "ai_ml" || roleId === "java_full_stack" || roleId === "python_full_stack";
}

function nowIso() {
  return new Date().toISOString();
}

export default function ApplyFlow(props: { token: string; initialStep?: number }) {
  const [activeStep, setActiveStep] = useState<number>(() => {
    const maybe = props.initialStep;
    if (maybe && maybe >= 1 && maybe <= 5) return maybe;
    return 1;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AllAnswers>({});
  const [status, setStatus] = useState<"in_progress" | "submitted">("in_progress");

  const pendingProctoringEventsRef = useRef<Array<{ type: string; details?: Record<string, unknown> }>>([]);
  const proctoringFlushTimerRef = useRef<number | null>(null);

  const selectedRoleId = answers.domain?.selectedRoleId;
  const selectedRoleLabel = roleLabelFromId(selectedRoleId);
  const codingLanguage = pickCodingLanguage(selectedRoleId);

  const domainQuestions = useMemo(() => {
    if (!selectedRoleId) return [];
    return DOMAIN_QUESTIONS[selectedRoleId];
  }, [selectedRoleId]);

  const codingProblems = useMemo(() => {
    if (!codingLanguage) return [];
    return CODING_PROBLEMS[codingLanguage];
  }, [codingLanguage]);

  const [codingHintShown, setCodingHintShown] = useState<Record<string, boolean>>({});

  const [videoState, setVideoState] = useState<{
    activeQuestionIndex: number;
    countdownSecRemaining: number;
    isRecording: boolean;
    recordedBlobs: Blob[];
    recordingStartedAtMs: number | null;
    uploadProgress: "idle" | "uploading" | "uploaded" | "error";
    lastError: string | null;
  }>({
    activeQuestionIndex: 0,
    countdownSecRemaining: 7,
    isRecording: false,
    recordedBlobs: [],
    recordingStartedAtMs: null,
    uploadProgress: "idle",
    lastError: null,
  });

  const attemptedQuestionIndices = useMemo(() => {
    return answers.video?.attemptedQuestionIndices ?? [];
  }, [answers.video?.attemptedQuestionIndices]);

  const uploadedQuestionIndices = useMemo(() => {
    return (answers.video?.recordings ?? []).map((r) => r.questionIndex);
  }, [answers.video?.recordings]);

  const activeQuestionHasUpload = uploadedQuestionIndices.includes(videoState.activeQuestionIndex);
  const activeQuestionWasAttempted = attemptedQuestionIndices.includes(videoState.activeQuestionIndex);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);

  const isSubmitted = status === "submitted";

  const stepBadge = (stepNumber: number) => {
    const active = stepNumber === activeStep;
    return (
      <div
        key={stepNumber}
        className={[
          "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
          active ? "border-black/30 bg-black/5" : "border-black/10 bg-white",
        ].join(" ")}
      >
        <span className="font-medium">{StepNames[stepNumber - 1]}</span>
        <span className="text-[11px] text-black/50">Step {stepNumber}/5</span>
      </div>
    );
  };

  const scheduleProctoringFlush = useCallback(() => {
    if (proctoringFlushTimerRef.current) return;
    proctoringFlushTimerRef.current = window.setTimeout(async () => {
      proctoringFlushTimerRef.current = null;
      const events = pendingProctoringEventsRef.current.splice(0, pendingProctoringEventsRef.current.length);
      if (events.length === 0) return;

      try {
        await fetch("/api/application/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: props.token, events }),
        });
      } catch {
        // Never block the candidate flow for logging failures.
      }
    }, 1200);
  }, [props.token]);

  const logProctoringEvent = useCallback(
    (type: string, details?: Record<string, unknown>) => {
      pendingProctoringEventsRef.current.push({ type, details });
      scheduleProctoringFlush();
    },
    [scheduleProctoringFlush]
  );

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") logProctoringEvent("visibility_hidden");
    };
    const onBlur = () => logProctoringEvent("window_blur");
    const onFocus = () => logProctoringEvent("window_focus");
    const onCopy = () => logProctoringEvent("copy");
    const onPaste = () => logProctoringEvent("paste");
    const onCut = () => logProctoringEvent("cut");
    const onContextMenu = () => logProctoringEvent("context_menu");

    const onKeyDown = (e: KeyboardEvent) => {
      const blocked =
        (e.ctrlKey || e.metaKey) &&
        (e.key.toLowerCase() === "u" ||
          e.key.toLowerCase() === "s" ||
          e.key.toLowerCase() === "p" ||
          e.key.toLowerCase() === "i" ||
          e.key.toLowerCase() === "j");
      const isF12 = e.key === "F12";
      if (blocked || isF12) {
        logProctoringEvent("blocked_shortcut", { key: e.key, ctrl: e.ctrlKey, meta: e.metaKey, shift: e.shiftKey });
      }
    };

    const devtoolsCheckInterval = window.setInterval(() => {
      const widthGap = Math.abs(window.outerWidth - window.innerWidth);
      const heightGap = Math.abs(window.outerHeight - window.innerHeight);
      if (widthGap > 180 || heightGap > 180) {
        logProctoringEvent("suspected_devtools", { widthGap, heightGap });
      }
      logProctoringEvent("heartbeat");
    }, 15000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("keydown", onKeyDown);
      window.clearInterval(devtoolsCheckInterval);
    };
  }, [logProctoringEvent]);

  const loadAssessment = useCallback(async () => {
    setLoadError(null);
    try {
      const response = await fetch("/api/application/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: props.token }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Load failed");
      }

      const parsed = LoadResponseSchema.parse(await response.json());
      const assessment = parsed.assessment as StoredAssessment;

      setAssessmentId(assessment.id);
      setStatus(assessment.status);
      setAnswers(assessment.answers ?? {});
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load assessment");
    }
  }, [props.token]);

  useEffect(() => {
    void loadAssessment();
  }, [loadAssessment]);

  const saveAnswers = useCallback(
    async (answersPatch: Partial<AllAnswers>) => {
      if (isSubmitted) return;
      setSaveState("saving");
      try {
        const response = await fetch("/api/application/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: props.token, answersPatch }),
        });
        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Save failed");
        }
        setAnswers((prev) => ({ ...prev, ...answersPatch }));
        setSaveState("saved");
        window.setTimeout(() => setSaveState("idle"), 800);
      } catch {
        setSaveState("error");
      }
    },
    [props.token, isSubmitted]
  );

  const goNext = () => setActiveStep((s) => Math.min(5, s + 1));
  const goBack = () => setActiveStep((s) => Math.max(1, s - 1));

  const commonHeader = (
    <div className="flex flex-col gap-1">
      <div className="text-[12px] text-black/55">Be brutally honest. Each answer guides your training and placement.</div>
      <div className="text-[11px] text-black/45">Integrity monitor: tab switching / focus changes / copy-paste are logged.</div>
    </div>
  );

  const saveBadge = (
    <div className="text-[11px] text-black/55">
      {saveState === "saving" && "Saving…"}
      {saveState === "saved" && "Saved"}
      {saveState === "error" && "Save failed (check internet)"}
      {saveState === "idle" && " "}
    </div>
  );

  const Step1 = (
    <Card title="Step 1 — Personality" right={saveBadge}>
      {commonHeader}
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <TinyLabel>Hobbies</TinyLabel>
          <Textarea
            rows={4}
            value={answers.personality?.hobbies ?? ""}
            onChange={(e) => void saveAnswers({ personality: { ...(answers.personality ?? {}), hobbies: e.target.value } })}
            placeholder="Short and real."
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Daily routine</TinyLabel>
          <Textarea
            rows={4}
            value={answers.personality?.dailyRoutine ?? ""}
            onChange={(e) => void saveAnswers({ personality: { ...(answers.personality ?? {}), dailyRoutine: e.target.value } })}
            placeholder="Morning to night, high level."
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Daily availability for training</TinyLabel>
          <Select
            value={answers.personality?.dailyAvailability ?? ""}
            onChange={(e) => void saveAnswers({ personality: { ...(answers.personality ?? {}), dailyAvailability: e.target.value as any } })}
            disabled={isSubmitted}
          >
            <option value="" disabled>
              Select
            </option>
            <option value="0-1h">0–1 hour</option>
            <option value="1-2h">1–2 hours</option>
            <option value="2-4h">2–4 hours</option>
            <option value="4h+">4+ hours</option>
          </Select>
        </div>

        <div className="space-y-1">
          <TinyLabel>Pressure (family / visa / money / deadlines)</TinyLabel>
          <Textarea
            rows={4}
            value={answers.personality?.pressureNotes ?? ""}
            onChange={(e) => void saveAnswers({ personality: { ...(answers.personality ?? {}), pressureNotes: e.target.value } })}
            placeholder="Write what’s actually happening."
            disabled={isSubmitted}
          />
        </div>
      </div>

      <Divider />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={Boolean(answers.personality?.honestyCommitment)}
          onChange={(e) => void saveAnswers({ personality: { ...(answers.personality ?? {}), honestyCommitment: e.target.checked } })}
          disabled={isSubmitted}
        />
        I will answer honestly.
      </label>

      <Divider />
      <div className="flex items-center justify-between">
        <div />
        <Button onClick={goNext} disabled={isSubmitted}>
          Continue
        </Button>
      </div>
    </Card>
  );

  const Step2 = (
    <Card title="Step 2 — AI usage level" right={saveBadge}>
      {commonHeader}
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <TinyLabel>AI chatbots you know</TinyLabel>
          <Textarea
            rows={4}
            value={answers.aiUsage?.knownChatbots ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), knownChatbots: e.target.value } })}
            placeholder="Example: ChatGPT, Claude, Gemini, etc."
            disabled={isSubmitted}
          />
        </div>
        <div className="space-y-1">
          <TinyLabel>Other AI tools (image / video / audio)</TinyLabel>
          <Textarea
            rows={4}
            value={answers.aiUsage?.otherAiTools ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), otherAiTools: e.target.value } })}
            placeholder="Tools you used, even once."
            disabled={isSubmitted}
          />
        </div>
        <div className="space-y-1">
          <TinyLabel>Agents / coding assistants you know</TinyLabel>
          <Textarea
            rows={4}
            value={answers.aiUsage?.knownAgents ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), knownAgents: e.target.value } })}
            placeholder="Example: Codex, Cursor, Copilot, etc."
            disabled={isSubmitted}
          />
        </div>
        <div className="space-y-1">
          <TinyLabel>Automation tools you know</TinyLabel>
          <Textarea
            rows={4}
            value={answers.aiUsage?.automationTools ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), automationTools: e.target.value } })}
            placeholder="Example: Make, n8n, Zapier, etc."
            disabled={isSubmitted}
          />
        </div>
      </div>

      <Divider />
      <div className="space-y-4">
        <div className="space-y-1">
          <TinyLabel>Prompt task 1 (technical, non-coding)</TinyLabel>
          <Muted>Scenario: an API request returns 401. Write a prompt to get a step-by-step diagnosis plan.</Muted>
          <Textarea
            rows={5}
            value={answers.aiUsage?.promptTask1 ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask1: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Prompt task 2 (situational)</TinyLabel>
          <Muted>Scenario: you have 7 days. Balance learning + job search. Write a prompt to get a realistic daily plan.</Muted>
          <Textarea
            rows={5}
            value={answers.aiUsage?.promptTask2 ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask2: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Prompt task 3 (in-depth)</TinyLabel>
          <Muted>Scenario: you want an 8-week roadmap for your chosen domain. Write a prompt to get a structured plan with milestones.</Muted>
          <Textarea
            rows={6}
            value={answers.aiUsage?.promptTask3 ?? ""}
            onChange={(e) => void saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask3: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>
      </div>

      <Divider />
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>
        <Button onClick={goNext} disabled={isSubmitted}>
          Continue
        </Button>
      </div>
    </Card>
  );

  const Step3 = (
    <Card
      title="Step 3 — Choose your domain"
      right={
        <Button variant="ghost" onClick={() => (window.location.href = `/roles?token=${encodeURIComponent(props.token)}`)}>
          Unsure? View roles
        </Button>
      }
    >
      {commonHeader}
      <Divider />

      <div className="grid gap-3 md:grid-cols-2">
        {ROLE_MARKET.map((role) => {
          const selected = role.roleId === selectedRoleId;
          return (
            <button
              key={role.roleId}
              onClick={() => void saveAnswers({ domain: { selectedRoleId: role.roleId } })}
              disabled={isSubmitted}
              className={[
                "rounded-2xl border p-4 text-left transition",
                selected ? "border-black/35 bg-black/5" : "border-black/10 hover:border-black/20",
              ].join(" ")}
            >
              <div className="text-sm font-semibold">{role.label}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12px] text-black/70">
                <div className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                  <span>Demand</span>
                  <span className="font-medium">{role.demand}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                  <span>Supply</span>
                  <span className="font-medium">{role.supply}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                  <span>Avg companies</span>
                  <span className="font-medium">{role.averageCompanyUsd}</span>
                </div>
                <div className="col-span-2 flex items-center justify-between rounded-xl border border-black/10 px-3 py-2">
                  <span>Top-tier</span>
                  <span className="font-medium">{role.topTierUsd}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Divider />
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>
        <Button onClick={goNext} disabled={!selectedRoleId || isSubmitted}>
          Continue
        </Button>
      </div>
    </Card>
  );

  const Step4 = (
    <Card title="Step 4 — Domain basics + coding (if applicable)" right={saveBadge}>
      {commonHeader}
      <Divider />

      {!selectedRoleId ? (
        <div className="space-y-2">
          <div className="text-sm">Select your domain first.</div>
          <Button variant="ghost" onClick={() => setActiveStep(3)}>
            Go to domain selection
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-2">
            <div className="text-sm font-semibold">{selectedRoleLabel}</div>
            <Muted>Answer basic questions. Short answers are fine.</Muted>
          </div>

          <div className="space-y-4">
            {domainQuestions.map((q) => {
              const value = answers.domainKnowledge?.answersByQuestionId?.[q.id] ?? "";
              return (
                <div key={q.id} className="rounded-2xl border border-black/10 p-4">
                  <div className="text-sm font-medium">{q.prompt}</div>
                  <div className="mt-3">
                    {q.kind === "mcq" ? (
                      <Select
                        value={value}
                        onChange={(e) => {
                          const next = { ...(answers.domainKnowledge?.answersByQuestionId ?? {}), [q.id]: e.target.value };
                          void saveAnswers({ domainKnowledge: { ...(answers.domainKnowledge ?? {}), answersByQuestionId: next } });
                        }}
                        disabled={isSubmitted}
                      >
                        <option value="" disabled>
                          Select
                        </option>
                        {q.options?.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        value={value}
                        onChange={(e) => {
                          const next = { ...(answers.domainKnowledge?.answersByQuestionId ?? {}), [q.id]: e.target.value };
                          void saveAnswers({ domainKnowledge: { ...(answers.domainKnowledge ?? {}), answersByQuestionId: next } });
                        }}
                        disabled={isSubmitted}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {shouldShowCoding(selectedRoleId) && (
            <div className="space-y-4">
              <Divider />
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Coding (basic)</div>
                  <Muted>You can skip any question. Manual review + optional AI scoring.</Muted>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(answers.domainKnowledge?.coding?.optedOutOfCoding)}
                    onChange={(e) =>
                      void saveAnswers({
                        domainKnowledge: {
                          ...(answers.domainKnowledge ?? {}),
                          coding: {
                            ...(answers.domainKnowledge?.coding ?? {}),
                            language: codingLanguage ?? undefined,
                            optedOutOfCoding: e.target.checked,
                            problems: answers.domainKnowledge?.coding?.problems ?? [],
                          },
                        },
                      })
                    }
                    disabled={isSubmitted}
                  />
                  I don’t know coding
                </label>
              </div>

              {!answers.domainKnowledge?.coding?.optedOutOfCoding && (
                <div className="space-y-4">
                  {codingProblems.map((problem, index) => {
                    const existing = (answers.domainKnowledge?.coding?.problems ?? []).find((p) => p.problemId === problem.id);
                    const current = existing ?? {
                      problemId: problem.id,
                      skipped: false,
                      usedHint: false,
                      code: codingLanguage === "python" ? problem.starterCode.python ?? "" : problem.starterCode.java ?? "",
                    };

                    const updateProblem = (patch: Partial<typeof current>) => {
                      const nextProblems = (answers.domainKnowledge?.coding?.problems ?? []).filter((p) => p.problemId !== problem.id);
                      nextProblems.push({ ...current, ...patch });
                      void saveAnswers({
                        domainKnowledge: {
                          ...(answers.domainKnowledge ?? {}),
                          coding: {
                            ...(answers.domainKnowledge?.coding ?? {}),
                            language: codingLanguage ?? undefined,
                            optedOutOfCoding: false,
                            problems: nextProblems,
                          },
                        },
                      });
                    };

                    return (
                      <div key={problem.id} className="rounded-2xl border border-black/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">
                              {index + 1}. {problem.title}
                            </div>
                            <div className="mt-1 text-[12px] text-black/60">Difficulty: {problem.difficulty}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setCodingHintShown((prev) => ({ ...prev, [problem.id]: !prev[problem.id] }));
                                updateProblem({ usedHint: true });
                              }}
                              disabled={isSubmitted}
                            >
                              Hint
                            </Button>
                            <Button variant="ghost" onClick={() => updateProblem({ skipped: !current.skipped })} disabled={isSubmitted}>
                              {current.skipped ? "Unskip" : "Skip"}
                            </Button>
                          </div>
                        </div>

                        <div className="mt-3 text-sm">{problem.prompt}</div>

                        {codingHintShown[problem.id] && (
                          <div className="mt-3 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-[12px] text-black/70">{problem.hint}</div>
                        )}

                        <div className="mt-4">
                          <CodeMirror
                            value={current.code}
                            height="220px"
                            theme="light"
                            extensions={[codingLanguage === "python" ? python() : java()]}
                            editable={!isSubmitted && !current.skipped}
                            onChange={(value) => updateProblem({ code: value })}
                            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLineGutter: true }}
                          />
                        </div>
                        {current.skipped && <div className="mt-2 text-[12px] text-black/55">Skipped.</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <Divider />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
            </Button>
            <Button onClick={goNext} disabled={isSubmitted}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  async function ensureMediaStream() {
    if (mediaStreamRef.current) return mediaStreamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    mediaStreamRef.current = stream;
    return stream;
  }

  async function startRecordingForActiveQuestion() {
    setVideoState((s) => ({ ...s, lastError: null, uploadProgress: "idle" }));
    const stream = await ensureMediaStream();
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    mediaRecorderRef.current = recorder;

    const recordedBlobs: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedBlobs.push(event.data);
    };

    recorder.onstop = () => {
      setVideoState((s) => ({
        ...s,
        isRecording: false,
        recordedBlobs,
        recordingStartedAtMs: s.recordingStartedAtMs ?? null,
      }));

      // Auto-upload after stop (strict no re-record policy).
      window.setTimeout(() => {
        void uploadCurrentRecording();
      }, 250);
    };

    recorder.start(300);
    setVideoState((s) => ({ ...s, isRecording: true, recordedBlobs: [], recordingStartedAtMs: Date.now() }));

    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = window.setTimeout(() => {
      try {
        recorder.stop();
      } catch {}
    }, 3 * 60 * 1000);
  }

  async function uploadCurrentRecording() {
    if (activeQuestionHasUpload) return;
    const blobs = videoState.recordedBlobs;
    if (!blobs.length) return;

    const combinedBlob = new Blob(blobs, { type: "video/webm" });
    const sizeBytes = combinedBlob.size;
    const durationSec = videoState.recordingStartedAtMs
      ? Math.min(180, Math.ceil((Date.now() - videoState.recordingStartedAtMs) / 1000))
      : 0;

    setVideoState((s) => ({ ...s, uploadProgress: "uploading" }));
    try {
      const urlResponse = await fetch("/api/video/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          questionIndex: videoState.activeQuestionIndex,
          contentType: "video/webm",
        }),
      });

      if (!urlResponse.ok) throw new Error(await urlResponse.text());

      const { signedUrl, storagePath } = (await urlResponse.json()) as { signedUrl: string; storagePath: string };

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/webm" },
        body: combinedBlob,
      });

      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);

      const commitResponse = await fetch("/api/video/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          questionIndex: videoState.activeQuestionIndex,
          storagePath,
          durationSec,
          sizeBytes,
          createdAtIso: nowIso(),
        }),
      });

      if (!commitResponse.ok) throw new Error(await commitResponse.text());

      const nextRecordings = [...(answers.video?.recordings ?? [])].filter((r) => r.questionIndex !== videoState.activeQuestionIndex);
      nextRecordings.push({
        questionIndex: videoState.activeQuestionIndex,
        storagePath,
        durationSec,
        sizeBytes,
        createdAtIso: nowIso(),
      });

      setAnswers((prev) => ({ ...prev, video: { ...(prev.video ?? {}), recordings: nextRecordings } }));
      setVideoState((s) => ({ ...s, uploadProgress: "uploaded" }));
    } catch (e: any) {
      setVideoState((s) => ({ ...s, uploadProgress: "error", lastError: e?.message ?? "Upload failed" }));
    }
  }

  const Step5 = (
    <Card title="Step 5 — Video (5 questions)" right={saveBadge}>
      {commonHeader}
      <Divider />

      <div className="space-y-4">
        <div className="rounded-2xl border border-black/10 p-4">
          <div className="text-sm font-semibold">Question {videoState.activeQuestionIndex + 1} / 5</div>
          <div className="mt-2 text-sm">{VIDEO_QUESTIONS[videoState.activeQuestionIndex]}</div>
          <div className="mt-3 text-[12px] text-black/60">
            You get 7 seconds to think. Recording starts automatically. Max 3 minutes. No re-record.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!videoState.isRecording && (
            <Button
              onClick={async () => {
                try {
                  if (activeQuestionHasUpload || activeQuestionWasAttempted) return;

                  const nextAttempted = Array.from(
                    new Set([...(answers.video?.attemptedQuestionIndices ?? []), videoState.activeQuestionIndex])
                  );
                  void saveAnswers({ video: { ...(answers.video ?? {}), attemptedQuestionIndices: nextAttempted } });

                  setVideoState((s) => ({ ...s, countdownSecRemaining: 7, lastError: null, uploadProgress: "idle" }));
                  for (let t = 7; t >= 1; t--) {
                    setVideoState((s) => ({ ...s, countdownSecRemaining: t }));
                    await new Promise((r) => setTimeout(r, 1000));
                  }
                  setVideoState((s) => ({ ...s, countdownSecRemaining: 0 }));
                  await startRecordingForActiveQuestion();
                } catch (e: any) {
                  setVideoState((s) => ({ ...s, lastError: e?.message ?? "Camera/mic permission required" }));
                }
              }}
              disabled={isSubmitted || activeQuestionHasUpload || activeQuestionWasAttempted}
            >
              Start
            </Button>
          )}

          {videoState.isRecording && (
            <Button
              variant="danger"
              onClick={() => {
                try {
                  mediaRecorderRef.current?.stop();
                } catch {}
              }}
              disabled={isSubmitted}
            >
              Stop recording
            </Button>
          )}

          <div className="text-sm">
            {videoState.isRecording ? (
              <span className="font-medium">Recording…</span>
            ) : (
              <span className="text-black/60">Countdown: {videoState.countdownSecRemaining}s</span>
            )}
          </div>

          <div className="text-[12px] text-black/55">
            Upload: {videoState.uploadProgress}
            {videoState.lastError ? ` — ${videoState.lastError}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {videoState.uploadProgress === "error" && (
            <Button
              variant="ghost"
              onClick={async () => {
                await uploadCurrentRecording();
              }}
              disabled={isSubmitted || videoState.isRecording || videoState.recordedBlobs.length === 0 || videoState.uploadProgress === "uploading"}
            >
              Retry upload
            </Button>
          )}
          {activeQuestionHasUpload && <div className="text-[12px] text-black/60">Uploaded. Next question.</div>}
        </div>

        <div className="rounded-2xl border border-black/10 p-4">
          <div className="text-sm font-semibold">Recorded</div>
          <div className="mt-2 space-y-1 text-[12px] text-black/60">
            {Array.from({ length: 5 }).map((_, i) => {
              const uploaded = (answers.video?.recordings ?? []).some((r) => r.questionIndex === i);
              const attempted = (answers.video?.attemptedQuestionIndices ?? []).includes(i);
              if (uploaded) {
                const r = (answers.video?.recordings ?? []).find((x) => x.questionIndex === i)!;
                return (
                  <div key={i}>
                    Q{i + 1} — {r.durationSec}s — uploaded
                  </div>
                );
              }
              if (attempted) return <div key={i}>Q{i + 1} — recorded — upload pending</div>;
              return <div key={i}>Q{i + 1} — not started</div>;
            })}
          </div>
        </div>

        <Divider />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={goBack}>
            Back
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => setVideoState((s) => ({ ...s, activeQuestionIndex: Math.max(0, s.activeQuestionIndex - 1), uploadProgress: "idle", lastError: null, recordedBlobs: [] }))}
              disabled={videoState.activeQuestionIndex === 0}
            >
              Previous
            </Button>

            <Button
              variant="ghost"
              onClick={() => setVideoState((s) => ({ ...s, activeQuestionIndex: Math.min(4, s.activeQuestionIndex + 1), uploadProgress: "idle", lastError: null, recordedBlobs: [] }))}
              disabled={videoState.activeQuestionIndex === 4}
            >
              Next
            </Button>

            <Button
              onClick={async () => {
                if (isSubmitted) return;
                try {
                  const response = await fetch("/api/application/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: props.token }),
                  });
                  if (!response.ok) throw new Error(await response.text());
                  setStatus("submitted");
                  setSaveState("saved");
                } catch {
                  setSaveState("error");
                }
              }}
              disabled={isSubmitted}
            >
              Submit
            </Button>
          </div>
        </div>

        {isSubmitted && (
          <div className="rounded-2xl border border-black/10 bg-black/5 p-4 text-sm">Submitted. You can close this window.</div>
        )}
      </div>
    </Card>
  );

  if (loadError) {
    return (
      <Card title="Assessment link">
        <div className="space-y-2">
          <div className="text-sm text-red-600">{loadError}</div>
          <Button onClick={() => void loadAssessment()}>Retry</Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        <Card title="Progress">
          <div className="space-y-2">{[1, 2, 3, 4, 5].map(stepBadge)}</div>
          <Divider />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={() => setActiveStep(1)}>
              1
            </Button>
            <Button variant="ghost" onClick={() => setActiveStep(2)}>
              2
            </Button>
            <Button variant="ghost" onClick={() => setActiveStep(3)}>
              3
            </Button>
            <Button variant="ghost" onClick={() => setActiveStep(4)}>
              4
            </Button>
            <Button variant="ghost" onClick={() => setActiveStep(5)}>
              5
            </Button>
          </div>
        </Card>

        <Card title="Status">
          <div className="text-sm">{isSubmitted ? <span className="font-medium">Submitted</span> : <span className="font-medium">In progress</span>}</div>
          <Muted>Assessment ID: {assessmentId ?? "…"}</Muted>
        </Card>
      </div>

      <div className="space-y-4">
        {activeStep === 1 && Step1}
        {activeStep === 2 && Step2}
        {activeStep === 3 && Step3}
        {activeStep === 4 && Step4}
        {activeStep === 5 && Step5}
      </div>
    </div>
  );
}
