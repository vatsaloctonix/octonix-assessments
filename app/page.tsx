import { OctonixFrame, Card, Muted } from "@/components/ui";
export default function HomePage() {
  return (
    <OctonixFrame>
      <Card title="Open your assessment link">
        <div className="space-y-2">
          <div className="text-sm">This assessment is link-based.</div>
          <Muted>If you were sent a link by Octonix Solutions, open that link directly.</Muted>
        </div>
      </Card>
    </OctonixFrame>
  );
}
