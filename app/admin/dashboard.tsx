"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Card, Button, Input, Muted, Divider, TinyLabel } from "@/components/ui";
import type { StoredAssessment } from "@/lib/types";

export default function AdminDashboard() {
  const pathname = usePathname();
  const basePath = pathname?.startsWith("/trainer") ? "/trainer" : "/admin";

  const [items, setItems] = useState<StoredAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCandidateLabel, setNewCandidateLabel] = useState("");
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const copyToClipboard = async (text: string, tokenId?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (tokenId) {
        setCopiedToken(tokenId);
        setTimeout(() => setCopiedToken(null), 2000);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

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

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} assessment(s)? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Delete failed");
      }

      setSelectedIds(new Set());
      await refresh();
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card title="Create candidate link">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <TinyLabel>Candidate name </TinyLabel>
            <Input value={newCandidateLabel} onChange={(e) => setNewCandidateLabel(e.target.value)} placeholder="Example: vatsal - AI/ML" />
            <Muted>Link will be auto copied after creation</Muted>
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

                // Auto-copy link to clipboard
                await copyToClipboard(data.url);

                await refresh();
              }}
            >
              Create
            </Button>
          </div>
        </div>
        {createdLink && (
          <div className="mt-3 rounded-xl border border-green-500/30 bg-green-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 overflow-hidden">
                <div className="text-xs font-medium text-green-800">Assessment Link {copiedLink && "- Copied!"}</div>
                <a className="block truncate text-sm text-green-700 underline" href={createdLink} target="_blank" rel="noopener noreferrer">
                  {createdLink}
                </a>
              </div>
              <Button
                variant="ghost"
                onClick={() => copyToClipboard(createdLink)}
                className="text-xs"
              >
                {copiedLink ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card
        title="Submissions"
        right={
          <div className="flex flex-wrap gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="danger"
                onClick={() => handleDelete(Array.from(selectedIds))}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : `Delete (${selectedIds.size})`}
              </Button>
            )}
            <Button variant="ghost" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className="text-sm">Loading...</div>
        ) : (
          <div className="space-y-2">
            {items.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.size === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
                <span className="text-black/60">Select all</span>
              </div>
            )}

            {items.map((item) => {
              const assessmentUrl = `${window.location.origin}/apply/${item.token}`;
              return (
                <div
                  key={item.id}
                  className={[
                    "flex items-center gap-3 rounded-2xl border p-4 transition",
                    selectedIds.has(item.id) ? "border-red-500/30 bg-red-50" : "border-black/10 hover:border-black/20",
                  ].join(" ")}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <a href={`${basePath}/${item.id}`} className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{item.admin_label ?? "Candidate"}</div>
                        <div className="text-[12px] text-black/60">Status: {item.status}</div>
                        <div className="mt-1 text-[11px] text-black/50">
                          Link: {assessmentUrl.slice(0, 50)}...
                        </div>
                      </div>
                      <div className="text-[12px] text-black/55">Updated: {new Date(item.updated_at).toLocaleString()}</div>
                    </div>
                  </a>
                  <Button
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      copyToClipboard(assessmentUrl, item.id);
                    }}
                    className="text-xs"
                  >
                    {copiedToken === item.id ? "Copied!" : "Copy Link"}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete([item.id]);
                    }}
                    disabled={deleting}
                    className="text-xs"
                  >
                    Delete
                  </Button>
                </div>
              );
            })}
            {items.length === 0 && <Muted>No submissions yet.</Muted>}
          </div>
        )}
        <Divider />
        <Muted>Click on titles to open a submission to see answers, proctoring, AI score, and videos.</Muted>
      </Card>
    </div>
  );
}
