"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ROLE_MARKET } from "@/lib/assessmentConfig";
import { Card, Button, Muted, Divider } from "@/components/ui";

export default function RolesClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const backHref = useMemo(() => {
    if (!token) return "/";
    return `/apply/${encodeURIComponent(token)}?step=3`;
  }, [token]);

  return (
    <div className="space-y-4">
      <Card
        title="Role snapshots (US market, 5+ years)"
        right={
          <Button variant="ghost" onClick={() => (window.location.href = backHref)}>
            Go back to application
          </Button>
        }
      >
        <Muted>Quick view: demand vs supply and typical compensation ranges.</Muted>
        <Divider />
        <div className="grid gap-3 md:grid-cols-2">
          {ROLE_MARKET.map((role) => (
            <Card key={role.roleId} title={role.label} className="p-4">
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Demand</span>
                  <span className="font-medium">{role.demand}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Supply</span>
                  <span className="font-medium">{role.supply}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Avg companies</span>
                  <span className="font-medium">{role.averageCompanyUsd}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-black/60">Top-tier</span>
                  <span className="font-medium">{role.topTierUsd}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
