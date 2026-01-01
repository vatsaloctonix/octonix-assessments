"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, Button, Divider, Input, Muted, Select, Textarea, TinyLabel, OctonixFrame } from "@/components/ui";
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
  const [showHonestyPopup, setShowHonestyPopup] = useState(true);
  const [showMonitoringPopup, setShowMonitoringPopup] = useState(false);
  const [monitoringPermissionsGranted, setMonitoringPermissionsGranted] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(() => {
    const maybe = props.initialStep;
    if (maybe && maybe >= 1 && maybe <= 5) return maybe;
    return 1;
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AllAnswers>({});
  const [status, setStatus] = useState<"in_progress" | "submitted">("in_progress");
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const monitoringStreamRef = useRef<MediaStream | null>(null);
  const monitoringVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareStreamRef = useRef<MediaStream | null>(null);

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
    onBreak: boolean;
    showInstructions: boolean;
    permissionGranted: boolean;
  }>({
    activeQuestionIndex: 0,
    countdownSecRemaining: 0,
    isRecording: false,
    recordedBlobs: [],
    recordingStartedAtMs: null,
    uploadProgress: "idle",
    lastError: null,
    onBreak: false,
    showInstructions: true,
    permissionGranted: false,
  });

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Set up monitoring video preview when permissions are granted
  useEffect(() => {
    if (monitoringPermissionsGranted && monitoringStreamRef.current && monitoringVideoRef.current) {
      console.log("[MONITORING] Setting up video preview");
      monitoringVideoRef.current.srcObject = monitoringStreamRef.current;
      monitoringVideoRef.current.play().catch((e) => console.error("[MONITORING] Preview play error:", e));
    }
  }, [monitoringPermissionsGranted]);

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
  const [redirectCountdown, setRedirectCountdown] = useState(15);

  // Auto-redirect after submission
  useEffect(() => {
    if (!isSubmitted) return;

    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          window.location.href = "https://google.com";
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted]);

  const stepBadge = (stepNumber: number) => {
    const active = stepNumber === activeStep;
    const completed = completedSteps.has(stepNumber);
    return (
      <div
        key={stepNumber}
        className={[
          "flex items-center justify-between rounded-xl border px-3 py-2 text-sm",
          completed ? "border-green-500/30 bg-green-50" : active ? "border-black/30 bg-black/5" : "border-black/10 bg-white",
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
      if (document.visibilityState === "hidden") logProctoringEvent("tabSwitch");
    };
    const onBlur = () => logProctoringEvent("tabSwitch");
    const onFocus = () => logProctoringEvent("window_focus");
    const onCopy = () => logProctoringEvent("copyAttempt");
    const onPaste = () => logProctoringEvent("pasteAttempt");
    const onCut = () => logProctoringEvent("cutAttempt");
    const onContextMenu = () => logProctoringEvent("contextMenu");

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
      setCandidateName(assessment.admin_label);
      setAnswers(assessment.answers ?? {});

      // Load last active step
      if (assessment.current_step && assessment.current_step >= 1 && assessment.current_step <= 5) {
        console.log(`[PROGRESS] Resuming from step ${assessment.current_step}`);
        setActiveStep(assessment.current_step);
      }

      // Don't show honesty popup if already submitted or if resuming from later step
      if (assessment.status === "submitted" || (assessment.current_step && assessment.current_step > 1)) {
        setShowHonestyPopup(false);
        setShowMonitoringPopup(false);
        setMonitoringPermissionsGranted(true); // Skip monitoring request if resuming
      }
    } catch (e: any) {
      setLoadError(e?.message ?? "Failed to load assessment");
    }
  }, [props.token]);

  useEffect(() => {
    void loadAssessment();
  }, [loadAssessment]);

  // Save current step whenever it changes
  useEffect(() => {
    if (!props.token || isSubmitted) return;
    if (activeStep < 1 || activeStep > 5) return;

    console.log(`[PROGRESS] Saving current step: ${activeStep}`);
    // Save to database
    fetch("/api/application/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: props.token, currentStep: activeStep }),
    }).catch((e) => console.error("[PROGRESS] Failed to save step:", e));
  }, [activeStep, props.token, isSubmitted]);

  const saveTimerRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Partial<AllAnswers>>({});

  const saveAnswers = useCallback(
    (answersPatch: Partial<AllAnswers>) => {
      if (isSubmitted) return;

      // Optimistic update - update local state immediately
      setAnswers((prev) => {
        const merged = { ...prev };
        for (const key in answersPatch) {
          const k = key as keyof AllAnswers;
          if (typeof answersPatch[k] === 'object' && !Array.isArray(answersPatch[k])) {
            merged[k] = { ...(prev[k] as any), ...(answersPatch[k] as any) } as any;
          } else {
            merged[k] = answersPatch[k] as any;
          }
        }
        return merged;
      });

      // Merge into pending save
      for (const key in answersPatch) {
        const k = key as keyof AllAnswers;
        if (typeof answersPatch[k] === 'object' && !Array.isArray(answersPatch[k])) {
          pendingSaveRef.current[k] = { ...(pendingSaveRef.current[k] as any), ...(answersPatch[k] as any) } as any;
        } else {
          pendingSaveRef.current[k] = answersPatch[k] as any;
        }
      }

      // Debounce server save
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);

      saveTimerRef.current = window.setTimeout(async () => {
        const toSave = { ...pendingSaveRef.current };
        pendingSaveRef.current = {};

        setSaveState("saving");
        try {
          const response = await fetch("/api/application/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: props.token, answersPatch: toSave }),
          });
          if (!response.ok) {
            const text = await response.text();
            throw new Error(text || "Save failed");
          }
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 800);
        } catch {
          setSaveState("error");
          // Re-queue failed save
          for (const key in toSave) {
            const k = key as keyof AllAnswers;
            pendingSaveRef.current[k] = toSave[k] as any;
          }
        }
      }, 600);
    },
    [props.token, isSubmitted]
  );

  // Validation functions
  const isStep1Valid = () => {
    const p = answers.personality;
    return (
      hobbiesArray.length > 0 &&
      p?.dailyAvailability !== undefined &&
      p?.pressureNotes !== undefined && p.pressureNotes.trim().length > 0 &&
      p?.honestyCommitment === true
    );
  };

  const isStep2Valid = () => {
    const ai = answers.aiUsage;
    return (
      ai?.promptTask1 !== undefined && ai.promptTask1.trim().length > 0 &&
      ai?.promptTask2 !== undefined && ai.promptTask2.trim().length > 0 &&
      ai?.promptTask3 !== undefined && ai.promptTask3.trim().length > 0
    );
  };

  const isStep3Valid = () => {
    return selectedRoleId !== undefined;
  };

  const isStep4Valid = () => {
    // Step 4 allows skipping, so always valid
    return true;
  };

  const isStep5Valid = () => {
    // All 5 videos must be uploaded
    return uploadedQuestionIndices.length === 5;
  };

  const canProceedFromStep = (step: number) => {
    switch (step) {
      case 1: return isStep1Valid();
      case 2: return isStep2Valid();
      case 3: return isStep3Valid();
      case 4: return isStep4Valid();
      case 5: return isStep5Valid();
      default: return false;
    }
  };

  const goNext = () => {
    if (!canProceedFromStep(activeStep)) return;
    setCompletedSteps((prev) => new Set(prev).add(activeStep));
    setActiveStep((s) => Math.min(5, s + 1));
  };
  const goBack = () => setActiveStep((s) => Math.max(1, s - 1));

  const commonHeader = (
    <div className="flex flex-col gap-1">
      <div className="text-[12px] text-black/55">Be brutally honest. Each answer guides your training and placement.</div>
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

  const hobbiesArray = useMemo(() => {
    const raw = answers.personality?.hobbies;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string" && raw.length > 0) return [raw];
    return [];
  }, [answers.personality?.hobbies]);

  const [hobbyInput, setHobbyInput] = useState("");

  const addHobby = (hobby: string) => {
    const trimmed = hobby.trim();
    if (!trimmed || hobbiesArray.includes(trimmed)) return;
    const newHobbies = [...hobbiesArray, trimmed];
    saveAnswers({ personality: { ...(answers.personality ?? {}), hobbies: newHobbies } });
    setHobbyInput("");
  };

  const removeHobby = (index: number) => {
    const newHobbies = hobbiesArray.filter((_, i) => i !== index);
    saveAnswers({ personality: { ...(answers.personality ?? {}), hobbies: newHobbies } });
  };

  const Step1 = (
    <Card title="Step 1 - Personality" right={saveBadge}>
      {commonHeader}
      <Divider />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <TinyLabel>Hobbies</TinyLabel>
          <div className="rounded-xl border border-black/10 bg-white p-2">
            <div className="flex flex-wrap gap-2 mb-2">
              {hobbiesArray.map((hobby, index) => (
                <div key={index} className="flex items-center gap-1 rounded-lg bg-black/5 px-2 py-1 text-sm">
                  <span>{hobby}</span>
                  {!isSubmitted && (
                    <button
                      type="button"
                      onClick={() => removeHobby(index)}
                      className="ml-1 text-black/40 hover:text-black/80"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Input
              value={hobbyInput}
              onChange={(e) => setHobbyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addHobby(hobbyInput);
                } else if (e.key === " " && hobbyInput.trim()) {
                  e.preventDefault();
                  addHobby(hobbyInput);
                }
              }}
              onBlur={() => {
                if (hobbyInput.trim()) {
                  addHobby(hobbyInput);
                }
              }}
              placeholder="Type and press Enter, comma, or space"
              disabled={isSubmitted}
              className="border-0 p-1 text-sm focus:outline-none"
            />
          </div>
          <Muted>Press Enter, comma, space, or click outside to add</Muted>
        </div>

        <div className="space-y-1 md:col-span-2">
          <TinyLabel>Daily availability for training</TinyLabel>
          {(() => {
            const avail = answers.personality?.dailyAvailability;
            const isNewFormat = typeof avail === "object" && avail !== null && "timezone" in avail;

            type AvailabilityFormat = {
              timezone: "EST" | "PST" | "CST" | "MST";
              schedule: Array<{
                days: string[];
                ranges: Array<{ start: string; end: string }>;
              }>;
            };

            const currentTimezone = isNewFormat ? (avail as AvailabilityFormat).timezone : "EST";
            const currentSchedule = isNewFormat ? (avail as AvailabilityFormat).schedule : [];

            const updateAvailability = (updates: Partial<AvailabilityFormat>) => {
              const newAvail: AvailabilityFormat = isNewFormat
                ? { ...(avail as AvailabilityFormat), ...updates }
                : { timezone: currentTimezone, schedule: currentSchedule, ...updates };
              saveAnswers({ personality: { ...(answers.personality ?? {}), dailyAvailability: newAvail } });
            };

            const addTimeSlot = () => {
              const newSchedule = [...currentSchedule, { days: ["mon", "tue", "wed", "thu", "fri"], ranges: [{ start: "09:00", end: "17:00" }] }];
              updateAvailability({ schedule: newSchedule });
            };

            const removeTimeSlot = (index: number) => {
              const newSchedule = currentSchedule.filter((_, i) => i !== index);
              updateAvailability({ schedule: newSchedule });
            };

            const updateTimeSlot = (index: number, updates: Partial<typeof currentSchedule[0]>) => {
              const newSchedule = [...currentSchedule];
              newSchedule[index] = { ...newSchedule[index], ...updates };
              updateAvailability({ schedule: newSchedule });
            };

            return (
              <div className="space-y-3 rounded-xl border border-black/10 p-3">
                <div className="flex items-center gap-3">
                  <TinyLabel>Timezone</TinyLabel>
                  <Select
                    value={currentTimezone}
                    onChange={(e) => updateAvailability({ timezone: e.target.value as any })}
                    disabled={isSubmitted}
                    className="w-32"
                  >
                    <option value="EST">EST</option>
                    <option value="PST">PST</option>
                    <option value="CST">CST</option>
                    <option value="MST">MST</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  {currentSchedule.map((slot, index) => (
                    <div key={index} className="rounded-lg border border-black/10 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <TinyLabel>Time Slot {index + 1}</TinyLabel>
                        {!isSubmitted && (
                          <Button variant="ghost" onClick={() => removeTimeSlot(index)} className="text-xs">
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((day) => (
                          <label key={day} className="flex items-center gap-1 text-xs">
                            <input
                              type="checkbox"
                              checked={slot.days.includes(day)}
                              onChange={(e) => {
                                const newDays = e.target.checked
                                  ? [...slot.days, day]
                                  : slot.days.filter((d) => d !== day);
                                updateTimeSlot(index, { days: newDays });
                              }}
                              disabled={isSubmitted}
                            />
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </label>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {slot.ranges.map((range, rangeIndex) => (
                          <div key={rangeIndex} className="flex items-center gap-2 text-sm">
                            <input
                              type="time"
                              value={range.start || "09:00"}
                              onChange={(e) => {
                                const newRanges = [...slot.ranges];
                                newRanges[rangeIndex] = { ...range, start: e.target.value };
                                updateTimeSlot(index, { ranges: newRanges });
                              }}
                              disabled={isSubmitted}
                              className="rounded border border-black/10 px-2 py-1"
                            />
                            <span>to</span>
                            <input
                              type="time"
                              value={range.end || "17:00"}
                              onChange={(e) => {
                                const newRanges = [...slot.ranges];
                                newRanges[rangeIndex] = { ...range, end: e.target.value };
                                updateTimeSlot(index, { ranges: newRanges });
                              }}
                              disabled={isSubmitted}
                              className="rounded border border-black/10 px-2 py-1"
                            />
                            {slot.ranges.length > 1 && !isSubmitted && (
                              <Button
                                variant="ghost"
                                onClick={() => {
                                  const newRanges = slot.ranges.filter((_, i) => i !== rangeIndex);
                                  updateTimeSlot(index, { ranges: newRanges });
                                }}
                                className="text-xs"
                              >
                                ×
                              </Button>
                            )}
                          </div>
                        ))}
                        {!isSubmitted && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              const newRanges = [...slot.ranges, { start: "09:00", end: "17:00" }];
                              updateTimeSlot(index, { ranges: newRanges });
                            }}
                            className="text-xs"
                          >
                            + Add Time Range
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {!isSubmitted && (
                  <Button variant="ghost" onClick={addTimeSlot} className="w-full text-sm">
                    + Add Time Slot
                  </Button>
                )}
              </div>
            );
          })()}
        </div>

        <div className="space-y-1 md:col-span-2">
          <TinyLabel>Pressure (family / visa / money / deadlines)</TinyLabel>
          <Textarea
            rows={4}
            value={answers.personality?.pressureNotes ?? ""}
            onChange={(e) => saveAnswers({ personality: { ...(answers.personality ?? {}), pressureNotes: e.target.value } })}
            placeholder="Write what's actually happening."
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
        <Button onClick={goNext} disabled={isSubmitted || !isStep1Valid()}>
          Continue
        </Button>
      </div>
      {!isStep1Valid() && !isSubmitted && (
        <div className="mt-2 text-center">
          <Muted>Please complete all fields to continue</Muted>
        </div>
      )}
    </Card>
  );

  const Step2 = (
    <Card title="Step 2 - AI usage level" right={saveBadge}>
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
          <TinyLabel>Prompt task 1</TinyLabel>
          <Muted>Write a prompt that will draft a small reschedule interview email</Muted>
          <Textarea
            rows={5}
            value={answers.aiUsage?.promptTask1 ?? ""}
            onChange={(e) => saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask1: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Prompt task 2</TinyLabel>
          <Muted>Make a prompt that will write an essay on YouTube in most humanized way</Muted>
          <Textarea
            rows={5}
            value={answers.aiUsage?.promptTask2 ?? ""}
            onChange={(e) => saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask2: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>

        <div className="space-y-1">
          <TinyLabel>Prompt task 3</TinyLabel>
          <Muted>Pick any daily problem that you are facing, write a prompt and make AI solve it in the most logical way</Muted>
          <Textarea
            rows={6}
            value={answers.aiUsage?.promptTask3 ?? ""}
            onChange={(e) => saveAnswers({ aiUsage: { ...(answers.aiUsage ?? {}), promptTask3: e.target.value } })}
            disabled={isSubmitted}
          />
        </div>
      </div>

      <Divider />
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={goBack}>
          Back
        </Button>
        <Button onClick={goNext} disabled={isSubmitted || !isStep2Valid()}>
          Continue
        </Button>
      </div>
      {!isStep2Valid() && !isSubmitted && (
        <div className="mt-2 text-center">
          <Muted>Please answer all prompt tasks to continue</Muted>
        </div>
      )}
    </Card>
  );

  const Step3 = (
    <Card
      title="Step 3 - Choose your domain"
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
              onClick={() => saveAnswers({ domain: { selectedRoleId: role.roleId } })}
              disabled={isSubmitted}
              className={[
                "rounded-2xl border p-4 text-center transition",
                selected ? "border-black/35 bg-black/5 font-semibold" : "border-black/10 hover:border-black/20",
              ].join(" ")}
            >
              <div className="text-sm">{role.label}</div>
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
    <Card title="Step 4 - Domain basics + coding (if applicable)" right={saveBadge}>
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
    // Reuse monitoring stream if already granted
    if (monitoringStreamRef.current) {
      console.log("[VIDEO] Reusing monitoring stream for recording");
      mediaStreamRef.current = monitoringStreamRef.current;

      // Set preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = monitoringStreamRef.current;
        videoPreviewRef.current.play();
      }

      setVideoState((s) => ({ ...s, permissionGranted: true, lastError: null }));
      return monitoringStreamRef.current;
    }

    // Fallback: request permissions if monitoring stream not available
    if (mediaStreamRef.current) return mediaStreamRef.current;
    try {
      console.log("[VIDEO] Monitoring stream not found, requesting new permissions");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;

      // Set preview
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      setVideoState((s) => ({ ...s, permissionGranted: true, lastError: null }));
      return stream;
    } catch (error: any) {
      setVideoState((s) => ({ ...s, lastError: error?.message || "Camera/mic permission denied", permissionGranted: false }));
      throw error;
    }
  }

  async function startRecordingForActiveQuestion() {
    setVideoState((s) => ({ ...s, lastError: null, uploadProgress: "idle" }));
    const stream = await ensureMediaStream();
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp8,opus" });
    mediaRecorderRef.current = recorder;

    const recordedBlobs: Blob[] = [];
    const startTime = Date.now();
    const questionIndex = videoState.activeQuestionIndex;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) recordedBlobs.push(event.data);
    };

    recorder.onstop = () => {
      console.log(`[VIDEO] Recording stopped, blobs collected: ${recordedBlobs.length}`);
      setVideoState((s) => ({
        ...s,
        isRecording: false,
        recordedBlobs,
        recordingStartedAtMs: startTime,
      }));

      // Auto-upload after stop (strict no re-record policy).
      window.setTimeout(() => {
        console.log(`[VIDEO] Uploading ${recordedBlobs.length} blobs for question ${questionIndex}`);
        void uploadCurrentRecording(recordedBlobs, startTime, questionIndex);
      }, 250);
    };

    recorder.start(300);
    setVideoState((s) => ({ ...s, isRecording: true, recordedBlobs: [], recordingStartedAtMs: startTime }));

    if (autoStopTimerRef.current) window.clearTimeout(autoStopTimerRef.current);
    autoStopTimerRef.current = window.setTimeout(() => {
      try {
        recorder.stop();
      } catch {}
    }, 3 * 60 * 1000);
  }

  async function uploadCurrentRecording(blobs?: Blob[], recordingStartMs?: number, questionIdx?: number) {
    // Use provided parameters or fall back to state (for retry button)
    const recordedBlobs = blobs ?? videoState.recordedBlobs;
    const startMs = recordingStartMs ?? videoState.recordingStartedAtMs;
    const qIndex = questionIdx ?? videoState.activeQuestionIndex;

    console.log(`[VIDEO] Upload starting - blobs: ${recordedBlobs.length}, questionIndex: ${qIndex}`);

    if (activeQuestionHasUpload) {
      console.log("[VIDEO] Upload skipped - already has upload");
      return;
    }
    if (!recordedBlobs.length) {
      console.log("[VIDEO] Upload skipped - no blobs");
      return;
    }

    const combinedBlob = new Blob(recordedBlobs, { type: "video/webm" });
    const sizeBytes = combinedBlob.size;
    const durationSec = startMs
      ? Math.min(180, Math.ceil((Date.now() - startMs) / 1000))
      : 0;

    console.log(`[VIDEO] Combined blob size: ${sizeBytes} bytes, duration: ${durationSec}s`);

    setVideoState((s) => ({ ...s, uploadProgress: "uploading" }));
    try {
      console.log(`[VIDEO] Requesting upload URL for question ${qIndex}`);
      const urlResponse = await fetch("/api/video/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          questionIndex: qIndex,
          contentType: "video/webm",
        }),
      });

      if (!urlResponse.ok) throw new Error(await urlResponse.text());

      const { signedUrl, storagePath } = (await urlResponse.json()) as { signedUrl: string; storagePath: string };
      console.log(`[VIDEO] Got signed URL, uploading to storage...`);

      const uploadResponse = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": "video/webm" },
        body: combinedBlob,
      });

      if (!uploadResponse.ok) throw new Error(`Upload failed: ${uploadResponse.status}`);
      console.log(`[VIDEO] Upload to storage successful`);

      console.log(`[VIDEO] Committing upload metadata...`);
      const commitResponse = await fetch("/api/video/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: props.token,
          questionIndex: qIndex,
          storagePath,
          durationSec,
          sizeBytes,
          createdAtIso: nowIso(),
        }),
      });

      if (!commitResponse.ok) throw new Error(await commitResponse.text());
      console.log(`[VIDEO] Commit successful`);

      const nextRecordings = [...(answers.video?.recordings ?? [])].filter((r) => r.questionIndex !== qIndex);
      nextRecordings.push({
        questionIndex: qIndex,
        storagePath,
        durationSec,
        sizeBytes,
        createdAtIso: nowIso(),
      });

      console.log(`[VIDEO] Saving recordings to state, total: ${nextRecordings.length}`);
      setAnswers((prev) => ({ ...prev, video: { ...(prev.video ?? {}), recordings: nextRecordings } }));
      setVideoState((s) => ({ ...s, uploadProgress: "uploaded" }));
      console.log(`[VIDEO] Upload complete for question ${qIndex}`);
    } catch (e: any) {
      console.error(`[VIDEO] Upload error:`, e);
      setVideoState((s) => ({ ...s, uploadProgress: "error", lastError: e?.message ?? "Upload failed" }));
    }
  }

  const Step5 = (
    <Card title="Step 5 - Video Interview (5 questions)" right={saveBadge}>
      {/* Instructions Screen */}
      {videoState.showInstructions && (
        <div className="space-y-4">
          <div className="rounded-xl border border-black/10 bg-black/5 p-6">
            <h3 className="font-semibold">Video Interview Instructions</h3>
            <ul className="mt-3 space-y-2 text-sm text-black/70">
              <li>• We'll ask you 5 questions about yourself and your goals</li>
              <li>• For each question, you'll get a 7-second countdown to prepare</li>
              <li>• Recording starts automatically and lasts up to 3 minutes per question</li>
              <li>• You can stop recording early if you're done</li>
              <li>• Between questions, you can take a break if needed</li>
              <li>• Camera and microphone access is required</li>
            </ul>
          </div>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={async () => {
                console.log("[VIDEO] Requesting camera/mic permissions...");
                try {
                  await ensureMediaStream();
                  console.log("[VIDEO] Permissions granted, hiding instructions");
                  setVideoState((s) => ({ ...s, showInstructions: false, permissionGranted: true }));
                } catch (error) {
                  console.error("[VIDEO] Permission error:", error);
                  // Error already set in ensureMediaStream
                }
              }}
            >
              {videoState.permissionGranted ? "Continue to Questions" : "Grant Camera & Mic Access"}
            </Button>
          </div>
          {videoState.lastError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {videoState.lastError}
            </div>
          )}
        </div>
      )}

      {/* Main Video Interview */}
      {!videoState.showInstructions && (
        <div className="space-y-4">
          {/* Question Display */}
          <div className="rounded-2xl border border-black/10 p-6">
            <div className="text-center">
              <div className="text-sm font-medium text-black/50">Question {videoState.activeQuestionIndex + 1} of 5</div>
              <div className="mt-4 text-lg font-semibold">{VIDEO_QUESTIONS[videoState.activeQuestionIndex]}</div>
            </div>
          </div>

          {/* Video Preview + Countdown + Recording */}
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-black/10 bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {/* Countdown Overlay */}
            {videoState.countdownSecRemaining > 0 && !videoState.isRecording && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center">
                  <div className="text-8xl font-bold text-white">{videoState.countdownSecRemaining}</div>
                  <div className="mt-4 text-lg text-white/80">Get ready...</div>
                </div>
              </div>
            )}

            {/* Recording Indicator */}
            {videoState.isRecording && (
              <div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white">
                <div className="h-2 w-2 animate-pulse rounded-full bg-white"></div>
                Recording
              </div>
            )}

            {/* Upload Status */}
            {videoState.uploadProgress === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <div className="text-center text-white">
                  <div className="text-lg font-medium">Uploading...</div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!videoState.isRecording && videoState.countdownSecRemaining === 0 && !activeQuestionHasUpload && !activeQuestionWasAttempted && (
              <Button
                onClick={async () => {
                  console.log("[VIDEO] Start Recording button clicked");
                  try {
                    const nextAttempted = Array.from(new Set([...(answers.video?.attemptedQuestionIndices ?? []), videoState.activeQuestionIndex]));
                    saveAnswers({ video: { ...(answers.video ?? {}), attemptedQuestionIndices: nextAttempted } });

                    console.log("[VIDEO] Starting countdown from 7...");
                    // Countdown from 7 to 1
                    for (let t = 7; t >= 1; t--) {
                      console.log(`[VIDEO] Countdown: ${t} seconds`);
                      setVideoState((s) => ({ ...s, countdownSecRemaining: t, lastError: null, uploadProgress: "idle", onBreak: false }));
                      await new Promise((r) => setTimeout(r, 1000));
                    }

                    console.log("[VIDEO] Countdown complete, setting to 0");
                    setVideoState((s) => ({ ...s, countdownSecRemaining: 0 }));

                    console.log("[VIDEO] Starting recording...");
                    await startRecordingForActiveQuestion();
                    console.log("[VIDEO] Recording started successfully");
                  } catch (e: any) {
                    console.error("[VIDEO] Error during recording start:", e);
                    setVideoState((s) => ({ ...s, lastError: e?.message ?? "Camera/mic error" }));
                  }
                }}
                disabled={isSubmitted}
                className="px-8"
              >
                Start Recording
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
                className="px-8"
              >
                Stop Recording
              </Button>
            )}

            {activeQuestionHasUpload && (
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">✓ Uploaded</div>
                {videoState.activeQuestionIndex < 4 && (
                  <>
                    <Button
                      variant="ghost"
                      onClick={() => setVideoState((s) => ({ ...s, onBreak: true }))}
                      disabled={isSubmitted}
                    >
                      Take a Break
                    </Button>
                    <Button
                      onClick={() => setVideoState((s) => ({ ...s, activeQuestionIndex: s.activeQuestionIndex + 1, uploadProgress: "idle", lastError: null, recordedBlobs: [] }))}
                      disabled={isSubmitted}
                    >
                      Next Question →
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Break Screen */}
          {videoState.onBreak && (
            <div className="rounded-xl border border-black/10 bg-black/5 p-6 text-center">
              <div className="text-lg font-semibold">Take Your Time</div>
              <div className="mt-2 text-sm text-black/70">Resume whenever you're ready</div>
              <Button
                className="mt-4"
                onClick={() => setVideoState((s) => ({ ...s, onBreak: false, activeQuestionIndex: s.activeQuestionIndex + 1, uploadProgress: "idle", lastError: null, recordedBlobs: [] }))}
              >
                Continue
              </Button>
            </div>
          )}

          {/* Progress */}
          <div className="rounded-xl border border-black/10 p-4">
            <div className="text-sm font-semibold">Progress</div>
            <div className="mt-2 grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => {
                const uploaded = uploadedQuestionIndices.includes(i);
                const current = i === videoState.activeQuestionIndex;
                return (
                  <div
                    key={i}
                    className={[
                      "rounded-lg border px-2 py-3 text-center text-xs font-medium",
                      uploaded ? "border-green-500 bg-green-50 text-green-700" : current ? "border-black/30 bg-black/5" : "border-black/10",
                    ].join(" ")}
                  >
                    Q{i + 1}
                    {uploaded && " ✓"}
                  </div>
                );
              })}
            </div>
          </div>

          {videoState.lastError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {videoState.lastError}
              {videoState.uploadProgress === "error" && (
                <Button
                  variant="ghost"
                  onClick={async () => await uploadCurrentRecording()}
                  disabled={isSubmitted || videoState.recordedBlobs.length === 0}
                  className="ml-3"
                >
                  Retry Upload
                </Button>
              )}
            </div>
          )}

          {/* Navigation */}
          <Divider />
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={goBack}>
              Back
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
                } catch {
                  setSaveState("error");
                }
              }}
              disabled={isSubmitted}
            >
              Submit Assessment
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  if (loadError) {
    return (
      <OctonixFrame candidateName={candidateName}>
        <Card title="Assessment link">
          <div className="space-y-2">
            <div className="text-sm text-red-600">{loadError}</div>
            <Button onClick={() => void loadAssessment()}>Retry</Button>
          </div>
        </Card>
      </OctonixFrame>
    );
  }

  // Show submission success screen
  if (isSubmitted) {
    return (
      <OctonixFrame candidateName={candidateName}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="max-w-2xl">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
                <div className="text-3xl text-green-600">✓</div>
              </div>
              <h2 className="text-2xl font-semibold">Assessment Submitted!</h2>
              <p className="mt-3 text-black/70">
                Thank you for your time. Our experts will review your responses and get back to you within <strong>48 hours</strong>.
              </p>
              <div className="mt-6 rounded-xl border border-black/10 bg-black/5 p-4">
                <div className="text-sm text-black/60">
                  Redirecting to homepage in <strong>{redirectCountdown}</strong> seconds...
                </div>
              </div>
            </div>
          </Card>
        </div>
      </OctonixFrame>
    );
  }

  return (
    <OctonixFrame candidateName={candidateName}>
      {/* Honesty Popup */}
      {showHonestyPopup && !isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">A moment before we begin...</h2>
            <div className="mt-4 space-y-3 text-sm text-black/70">
              <p>
                This assessment is designed to understand <strong>your</strong> current level - not to judge you, but to create a <strong>customized training plan</strong> that actually works for you.
              </p>
              <p>
                The more honest you are, the better we can help you. If you're weak in an area, that's exactly what we need to know so we can strengthen it. If you're strong somewhere, we won't waste your time.
              </p>
              <p className="font-medium">
                Being brutally honest helps both of us: You get training that matches your actual needs, and we can place you faster in the right role.
              </p>
            </div>
            <div className="mt-6">
              <Button className="w-full" onClick={() => {
                setShowHonestyPopup(false);
                setShowMonitoringPopup(true);
              }}>
                I understand - Let's begin
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Monitoring Permissions Popup */}
      {showMonitoringPopup && !isSubmitted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-lg rounded-2xl border border-black/10 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold">Assessment Monitoring</h2>
            <div className="mt-4 space-y-3 text-sm text-black/70">
              <p>
                To ensure assessment integrity, we need to enable monitoring throughout the assessment.
              </p>
              <p className="font-medium">
                We will request:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Screen sharing</strong> - To monitor your screen during the assessment</li>
                <li><strong>Camera & Microphone</strong> - To verify your identity and record video responses</li>
              </ul>
              <p className="text-xs text-black/50">
                These permissions are required to proceed with the assessment.
              </p>
            </div>
            <div className="mt-6">
              <Button className="w-full" onClick={async () => {
                console.log("[MONITORING] Requesting screen share and camera/mic permissions...");
                try {
                  // Request screen share (just for intimidation, don't need to actually use it)
                  console.log("[MONITORING] Requesting screen share...");
                  const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false
                  });
                  screenShareStreamRef.current = screenStream;
                  console.log("[MONITORING] Screen share granted");

                  // Request camera and mic (show preview throughout, only record in Step 5)
                  console.log("[MONITORING] Requesting camera and microphone...");
                  const monitoringStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                  });
                  monitoringStreamRef.current = monitoringStream;
                  console.log("[MONITORING] Camera and mic granted");

                  // Set permissions granted - useEffect will set up the video preview
                  setMonitoringPermissionsGranted(true);
                  setShowMonitoringPopup(false);
                  console.log("[MONITORING] Permissions granted, preview will be set up by useEffect");
                } catch (error: any) {
                  console.error("[MONITORING] Permission error:", error);
                  alert(`Unable to enable monitoring: ${error.message}\n\nYou must grant these permissions to proceed with the assessment.`);
                }
              }}>
                Enable Monitoring & Continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
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

      {/* Monitoring Indicator - shows when permissions are granted */}
      {monitoringPermissionsGranted && !isSubmitted && (
        <div className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 shadow-lg">
          <div className="h-2 w-2 animate-pulse rounded-full bg-red-600"></div>
          <span>Screen & Video Monitoring Active</span>
        </div>
      )}

      {/* Camera Preview - persistent in bottom-right corner */}
      {monitoringPermissionsGranted && !isSubmitted && (
        <div className="fixed bottom-4 right-4 z-40 overflow-hidden rounded-xl border-2 border-black/20 shadow-2xl">
          <video
            ref={monitoringVideoRef}
            autoPlay
            muted
            playsInline
            className="h-32 w-40 object-cover"
          />
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-center text-[10px] font-medium text-white">
            Live Preview
          </div>
        </div>
      )}
    </OctonixFrame>
  );
}
