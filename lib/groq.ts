import { z } from "zod";

const GroqScoreSchema = z.object({
  overallScore0to100: z.number().min(0).max(100),
  sectionScores: z.object({
    honestySignal0to10: z.number().min(0).max(10),
    aiTooling0to10: z.number().min(0).max(10),
    promptEngineering0to10: z.number().min(0).max(10),
    domainBasics0to10: z.number().min(0).max(10),
    codingBasics0to10: z.number().min(0).max(10).optional(),
    communication0to10: z.number().min(0).max(10).optional(),
    integrityRisk0to10: z.number().min(0).max(10),
  }),
  answerValidations: z.record(z.boolean()),  // questionId -> isAcceptable (green=true, red=false)
  strengths: z.array(z.string()).max(8),
  risks: z.array(z.string()).max(8),
  recommendedNextSteps: z.array(z.string()).max(8),
  shortSummary: z.string().max(600),
  trainerSummary: z.object({
    knowledgeLevel: z.string().max(200),      // "Basic understanding of backend", "Strong Python skills", etc.
    availability: z.string().max(200),        // Human-readable availability
    bestFit: z.string().max(200),            // What they're best suited for
    trainingNeeds: z.string().max(200),      // What they need to learn
    readyToStart: z.enum(["Yes", "With basic training", "Needs significant training"]),
  }),
});

export type GroqEvaluation = z.infer<typeof GroqScoreSchema>;

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

export async function evaluateWithGroq(input: {
  roleLabel: string | null;
  answers: unknown;
  proctoring: unknown;
  videoBehavior: unknown;
}): Promise<GroqEvaluation> {
  const apiKey = requireEnv("GROQ_API_KEY");
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  const system = [
    "You are a practical trainer evaluator for Octonix Solutions.",
    "",
    "IMPORTANT: This is for TRAINING candidates, not hiring experienced developers.",
    "Knowledge is 'good to have' - focus on TRAINABILITY. Be lenient: 'Right' beats 'Perfect'.",
    "",
    "SCORING (be generous, give credit for trying):",
    "- overallScore0to100: Trainability + basic aptitude (60-80 is typical)",
    "- honestySignal0to10, aiTooling0to10, promptEngineering0to10, domainBasics0to10, codingBasics0to10, communication0to10: Rate 0-10",
    "- integrityRisk0to10: 0 = clean, 10 = very suspicious proctoring events",
    "",
    "VIDEO BEHAVIOR EVALUATION (if provided):",
    "Use video behavior data to assess communication0to10 score:",
    "- GOOD indicators: tone (calm/confident/professional), speed 6-7/10, low repetitive words, smooth flow, thoughtful pauses, appropriate hand movements",
    "- BAD indicators: excessive 'like/uhh/ummm', long gaps (>3s), nervous tone, rushed/very slow speech, no thought before answering",
    "- If behavior data is missing or empty, don't penalize - score communication based on text answers only",
    "- Question-specific good signs: starting ASAP (Q3), breaking into parts (Q1/Q2/Q4), saying 'it depends' (Q5), discussing improvement (Q4)",
    "",
    "ANSWER VALIDATION (Step 4 - Domain Questions):",
    "For each text-based question in domainKnowledge, validate if the answer is acceptable:",
    "- Don't expect perfection - just check if they understand the basic concept",
    "- Mark TRUE if answer shows basic understanding, FALSE if completely wrong/nonsensical/empty",
    "- Return answerValidations as object with questionId as key, boolean as value",
    "- Example: {\"ml_5\": true, \"ml_7\": false, \"pm_1\": true}",
    "- MCQ answers are auto-graded, only validate text answers",
    "",
    "OUTPUT MUST include ALL fields in this EXACT format:",
    "{",
    '  "overallScore0to100": 75,',
    '  "sectionScores": {',
    '    "honestySignal0to10": 8,',
    '    "aiTooling0to10": 7,',
    '    "promptEngineering0to10": 6,',
    '    "domainBasics0to10": 5,',
    '    "codingBasics0to10": 4,',
    '    "communication0to10": 7,',
    '    "integrityRisk0to10": 1',
    "  },",
    '  "answerValidations": {"ml_5": true, "ml_7": false, "ml_9": true},',
    '  "strengths": ["Good problem-solving", "Willing to learn"],',
    '  "risks": ["Limited coding experience"],',
    '  "recommendedNextSteps": ["Start with basics", "Provide mentoring"],',
    '  "shortSummary": "Trainable candidate with basic understanding...",',
    '  "trainerSummary": {',
    '    "knowledgeLevel": "Basic understanding of concepts",',
    '    "availability": "Mon-Fri 9am-5pm EST",',
    '    "bestFit": "Junior role with mentorship",',
    '    "trainingNeeds": "Fundamentals and hands-on practice",',
    '    "readyToStart": "With basic training"',
    "  }",
    "}",
    "",
    'CRITICAL: "readyToStart" must be EXACTLY one of: "Yes", "With basic training", or "Needs significant training"',
    "Return ONLY this JSON structure. No markdown, no extra text.",
  ].join("\n");

  const user = {
    roleLabel: input.roleLabel,
    answers: input.answers,
    proctoring: input.proctoring,
    videoBehavior: input.videoBehavior,
    outputSchema: GroqScoreSchema.shape,
  };

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) },
      ],
    }),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    // Return a more user-friendly error message
    if (response.status === 429) {
      throw new Error("AI service is experiencing high demand. Please try again in a moment.");
    } else if (response.status >= 500) {
      throw new Error("AI service is temporarily down. This usually resolves quickly.");
    } else {
      throw new Error(`Unable to connect to AI service (${response.status}). Please try again.`);
    }
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI service returned an incomplete response. Please try again.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("AI service returned an unexpected format. Please try again.");
  }

  return GroqScoreSchema.parse(parsed);
}
