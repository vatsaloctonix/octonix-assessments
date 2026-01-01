import { OctonixFrame, Card, Muted } from "@/components/ui";
export default function HomePage() {
  return (
    <OctonixFrame>
      <Card title="Open your assessment link">
        <div className="space-y-2">
          <div className="text-sm">Oops...wrong link?</div>
          <Muted>If you were sent a link by Octonix Solutions, open that link directly.current page isn't for assessment.
            feel free to contact support if you think this is an error.
          </Muted>
        </div>
      </Card>
    </OctonixFrame>
  );
}
