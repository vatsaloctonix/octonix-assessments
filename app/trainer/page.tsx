"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OctonixFrame } from "@/components/ui";
import AdminDashboard from "../admin/dashboard";

export default function TrainerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.push("/trainer/login");
          return;
        }
        const data = await res.json();
        if (data.admin.role !== "trainer" && data.admin.role !== "super_admin") {
          router.push("/trainer/login");
          return;
        }
        setAuthenticated(true);
        setLoading(false);
      } catch (error) {
        router.push("/trainer/login");
      }
    };
    checkAuth();
  }, [router]);

  if (loading || !authenticated) {
    return <div className="p-8">Loading...</div>;
  }

  return (
    <OctonixFrame isAdmin={true}>
      <AdminDashboard />
    </OctonixFrame>
  );
}
