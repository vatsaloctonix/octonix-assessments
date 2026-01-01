import { OctonixFrame } from "@/components/ui";
import AdminSubmissionClient from "./submissionClient";

export default async function AdminSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <OctonixFrame isAdmin={true}>
      <AdminSubmissionClient id={id} />
    </OctonixFrame>
  );
}
