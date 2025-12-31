import { OctonixFrame } from "@/components/ui";

import { Suspense } from "react";
import RolesClient from "./rolesClient";

export default function RolesPage() {
  return (
    <OctonixFrame>
      <Suspense fallback={<div className="text-sm text-black/60">Loading...</div>}>
        <RolesClient />
      </Suspense>
    </OctonixFrame>
  );
}
