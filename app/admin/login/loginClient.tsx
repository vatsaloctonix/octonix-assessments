"use client";

import { useState } from "react";
import { Card, Button, Input, Muted, TinyLabel } from "@/components/ui";

export default function AdminLoginClient() {
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  return (
    <Card title="Admin login">
      <div className="space-y-3 max-w-sm">
        <Muted>Octonix Solutions — internal access only.</Muted>
        <div>
          <TinyLabel>Admin password</TinyLabel>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              setState("loading");
              try {
                const res = await fetch("/api/admin/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ password }),
                });
                if (!res.ok) throw new Error();
                window.location.href = "/admin";
              } catch {
                setState("error");
              }
            }}
            disabled={!password || state === "loading"}
          >
            Login
          </Button>
          {state === "error" && <span className="text-sm text-red-600">Wrong password</span>}
        </div>
      </div>
    </Card>
  );
}
