"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";

export default function VideoAccessPage() {
  const params = useParams();
  const tokenId = params.tokenId as string;

  const [password, setPassword] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Please enter the password");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/video-access/${tokenId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to access video");
        setLoading(false);
        return;
      }

      setVideoUrl(data.videoUrl);
      setQuestionIndex(data.questionIndex);
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-black/5 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">Video Access</h1>
          <p className="mt-2 text-sm text-black/60">
            Enter the password to view this candidate video
          </p>
        </div>

        <Card title={videoUrl ? `Question ${(questionIndex ?? 0) + 1} Video` : "Protected Video"}>
          {!videoUrl ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Password</label>
                <Input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character password"
                  maxLength={6}
                  className="font-mono text-lg tracking-wider"
                  autoFocus
                />
                <p className="mt-1 text-xs text-black/50">
                  Password is case-insensitive and 6 characters long
                </p>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Verifying..." : "Access Video"}
              </Button>

              <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-800">
                <div className="font-medium mb-1">Important</div>
                <ul className="list-disc pl-4 space-y-1">
                  <li>This link can only be used once</li>
                  <li>The link will expire after a set time period</li>
                  <li>Make sure to watch the entire video before closing this page</li>
                </ul>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                Access granted! This link has now been marked as used and cannot be accessed again.
              </div>

              <video
                controls
                autoPlay
                className="w-full rounded-xl border border-black/10 bg-black"
                src={videoUrl}
              />

              <div className="text-center text-xs text-black/50">
                You can replay this video on this page, but you cannot access this link again after closing.
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
