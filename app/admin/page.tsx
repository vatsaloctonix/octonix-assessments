import { OctonixFrame } from "@/components/ui";
import AdminDashboard from "./dashboard";

export default function AdminPage() {
  return (
    <OctonixFrame isAdmin={true}>
      <AdminDashboard />
    </OctonixFrame>
  );
}
