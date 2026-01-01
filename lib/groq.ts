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
}): Promise<GroqEvaluation> {
  const apiKey = requireEnv("GROQ_API_KEY");
  const model = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

  const system = [
    "You are a practical trainer evaluator for Octonix Solutions.",
    "",
    "IMPORTANT CONTEXT:",
    "- This is for TRAINING candidates, not hiring experienced developers",
    "- Knowledge is 'good to have' not required - focus on TRAINABILITY",
    "- Be lenient: 'Right' is better than 'Perfect'",
    "- Evaluate their TEXT ANSWERS (AI prompts, coding attempts) for basic understanding",
    "",
    "SCORING APPROACH:",
    "- overallScore0to100: Trainability + basic aptitude (NOT perfection)",
    "- Give credit for trying, reasonable thinking, basic understanding",
    "- AI prompts: Are they coherent? Show problem-solving? (Don't need to be expert-level)",
    "- Coding: Did they try? Any logical thinking? (Syntax errors OK, logic matters)",
    "- Domain knowledge: Basic awareness is enough",
    "- integrityRisk0to10: 0 = clean, 10 = very suspicious",
    "",
    "TRAINER SUMMARY:",
    "- knowledgeLevel: What do they actually know? (Be specific but kind)",
    "- availability: Convert their schedule to readable format (e.g., 'Mon-Fri 9am-5pm EST')",
    "- bestFit: What role/tasks suit them based on answers?",
    "- trainingNeeds: What should trainer focus on?",
    "- readyToStart: Honest assessment of training readiness",
    "",
    "Return ONLY valid JSON (no markdown, no extra keys).",
  ].join("\n");

  const user = {
    roleLabel: input.roleLabel,
    answers: input.answers,
    proctoring: input.proctoring,
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
