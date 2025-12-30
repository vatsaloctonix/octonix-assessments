"use client";

import { useEffect, useState } from "react";
import { Card, Button, Input, Muted, Divider, TinyLabel } from "@/components/ui";
import type { StoredAssessment } from "@/lib/types";

export default function AdminDashboard() {
  const [items, setItems] = useState<StoredAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCandidateLabel, setNewCandidateLabel] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    const res = await fetch("/api/admin/submissions");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <Card title="Create candidate link">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <TinyLabel>Candidate label (optional)</TinyLabel>
            <Input value={newCandidateLabel} onChange={(e) => setNewCandidateLabel(e.target.value)} placeholder="Example: John — AI/ML" />
            <Muted>Only visible to you. Candidate will not be asked for resume or identity.</Muted>
          </div>
          <div className="flex items-end">
            <Button
              onClick={async () => {
                const res = await fetch("/api/admin/create-link", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ adminLabel: newCandidateLabel || null }),
                });
                const data = await res.json();
                setCreatedLink(data.url);
                setNewCandidateLabel("");
                await refresh();
              }}
            >
              Create link
            </Button>
          </div>
        </div>
        {createdLink && (
          <div className="mt-3 rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm">
            Link:{" "}
            <a className="underline" href={createdLink}>
              {createdLink}
            </a>
          </div>
        )}
      </Card>

      <Card title="Submissions" right={<Button variant="ghost" onClick={() => void refresh()}>Refresh</Button>}>
        {loading ? (
          <div className="text-sm">Loading…</div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <a
                key={item.id}
                href={`/admin/${item.id}`}
                className="block rounded-2xl border border-black/10 p-4 hover:border-black/20 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{item.admin_label ?? "Candidate"}</div>
                    <div className="text-[12px] text-black/60">Status: {item.status}</div>
                  </div>
                  <div className="text-[12px] text-black/55">Updated: {new Date(item.updated_at).toLocaleString()}</div>
                </div>
              </a>
            ))}
            {items.length === 0 && <Muted>No submissions yet.</Muted>}
          </div>
        )}
        <Divider />
        <Muted>Open a submission to see answers, proctoring signals, AI score, and videos.</Muted>
      </Card>
    </div>
  );
}
