import { OctonixFrame } from "@/components/ui";
import { Suspense } from "react";
import RolesClient from "./rolesClient";

export default function RolesPage() {
  return (
    <OctonixFrame>
      {/* changed [from direct render to Suspense wrapper because RolesClient uses useSearchParams] */}
      <Suspense fallback={<div className="text-sm text-black/60">Loading...</div>}>
        <RolesClient />
      </Suspense>
    </OctonixFrame>
  );
}
