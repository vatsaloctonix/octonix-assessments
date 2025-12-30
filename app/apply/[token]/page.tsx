import { OctonixFrame } from "@/components/ui";
import ApplyFlow from "./applyFlow";

export default async function ApplyPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const stepParam = typeof sp.step === "string" ? sp.step : undefined;
  const initialStep = stepParam ? Number(stepParam) : undefined;

  return (
    <OctonixFrame>
      <ApplyFlow token={token} initialStep={Number.isFinite(initialStep) ? initialStep : undefined} />
    </OctonixFrame>
  );
}
