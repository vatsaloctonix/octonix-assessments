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
    "You are an evaluator for Octonix Solutions candidate assessments.",
    "Be strict, practical, and consistent.",
    "Return ONLY valid JSON (no markdown, no extra keys).",
    "Scoring rules:",
    "- overallScore0to100 reflects hireability + trainability for a 5+ years candidate.",
    "- integrityRisk0to10: 0 = clean, 10 = very suspicious proctoring signals.",
    "- If a section is missing because candidate skipped, score it low but do not punish overall unfairly.",
    "Keep language concise and professional.",
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
    throw new Error(`Groq API failed: ${response.status} ${response.statusText} :: ${bodyText}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Groq API returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Groq did not return valid JSON");
  }

  return GroqScoreSchema.parse(parsed);
}
