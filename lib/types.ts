import { RoleId } from "./assessmentConfig";

export type PersonalityAnswers = {
  hobbies?: string | string[]; // Support both old (string) and new (array) format
  dailyRoutine?: string;
  dailyAvailability?: "0-1h" | "1-2h" | "2-4h" | "4h+" | {
    timezone: "EST" | "PST" | "CST" | "MST";
    schedule: Array<{
      days: string[];
      ranges: Array<{ start: string; end: string }>;
    }>;
  };
  pressureNotes?: string;
  honestyCommitment?: boolean;
};

export type AiUsageAnswers = {
  knownChatbots?: string;
  otherAiTools?: string;
  knownAgents?: string;
  automationTools?: string;
  promptTask1?: string;
  promptTask2?: string;
  promptTask3Problem?: string; // The problem the candidate is facing
  promptTask3?: string; // The prompt they would use to solve the problem
};

export type DomainSelectionAnswers = {
  selectedRoleId?: RoleId;
};

export type DomainKnowledgeAnswers = {
  answersByQuestionId?: Record<string, string>;
  coding?: {
    language?: "python" | "java";
    problems?: Array<{
      problemId: string;
      skipped: boolean;
      usedHint: boolean;
      code: string;
    }>;
    optedOutOfCoding?: boolean;
  };
};

export type VideoAnswers = {
  attemptedQuestionIndices?: number[];
  recordings?: Array<{
    questionIndex: number;
    storagePath: string;
    durationSec: number;
    sizeBytes: number;
    createdAtIso: string;
  }>;
};

export type AllAnswers = {
  personality?: PersonalityAnswers;
  aiUsage?: AiUsageAnswers;
  domain?: DomainSelectionAnswers;
  domainKnowledge?: DomainKnowledgeAnswers;
  video?: VideoAnswers;
};

export type ProctoringEvent = {
  atIso: string;
  type:
    | "visibility_hidden"
    | "window_blur"
    | "window_focus"
    | "copy"
    | "paste"
    | "cut"
    | "context_menu"
    | "blocked_shortcut"
    | "suspected_devtools"
    | "heartbeat";
  details?: Record<string, unknown>;
};

export type StoredAssessment = {
  id: string;
  token: string;
  admin_label: string | null;
  status: "in_progress" | "submitted";
  current_step?: number; // Track which step candidate is on
  answers: AllAnswers;
  proctoring: {
    counts: Record<string, number>;
    events: ProctoringEvent[];
  };
  ai_evaluations: Record<string, unknown>;
  videos: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};
