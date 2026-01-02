import { OctonixFrame } from "@/components/ui";
import AdminDashboard from "../admin/dashboard";

export default function TrainerPage() {
  return (
    <OctonixFrame isAdmin={true}>
      <AdminDashboard />
    </OctonixFrame>
  );
}
