import { OctonixFrame } from "@/components/ui";
import { Suspense } from "react";
import RolesClient from "./rolesClient";
export default function RolesPage() {
  return (
    <OctonixFrame>
      <Suspense fallback={<div />}>
        <RolesClient />
      </Suspense>
    </OctonixFrame>
  );
}
