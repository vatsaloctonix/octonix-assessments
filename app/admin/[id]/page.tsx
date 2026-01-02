import { redirect } from "next/navigation";
import { getSessionFromCookie } from "@/lib/auth";
import { OctonixFrame } from "@/components/ui";
import AdminSubmissionClient from "./submissionClient";

export default async function AdminSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  // Check authentication
  const sessionData = await getSessionFromCookie();
  if (!sessionData || (sessionData.admin.role !== "trainer" && sessionData.admin.role !== "super_admin")) {
    redirect("/trainer/login");
  }

  const { id } = await params;
  return (
    <OctonixFrame isAdmin={true}>
      <AdminSubmissionClient id={id} />
    </OctonixFrame>
  );
}
