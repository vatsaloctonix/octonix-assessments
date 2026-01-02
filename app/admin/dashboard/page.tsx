"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input } from "@/components/ui";

type Admin = { id: string; email: string; name: string; role: string };
type Trainer = { id: string; email: string; name: string; is_active: boolean; created_at: string };
type Assessment = { id: string; admin_label: string | null; status: string; created_at: string; submitted_at: string | null; ai_evaluations: any; creator: { name: string } | null };

export default function SuperAdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("recent");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTrainerEmail, setNewTrainerEmail] = useState("");
  const [newTrainerName, setNewTrainerName] = useState("");
  const [newTrainerPassword, setNewTrainerPassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadData(); }, [sortBy]);

  const loadData = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) { router.push("/admin/login"); return; }
      const meData = await meRes.json();
      if (meData.admin.role !== "super_admin") { router.push("/admin/login"); return; }
      setAdmin(meData.admin);

      const trainersRes = await fetch("/api/super-admin/trainers");
      const trainersData = await trainersRes.json();
      setTrainers(trainersData.trainers || []);

      const dashRes = await fetch(`/api/super-admin/dashboard?sortBy=${sortBy}`);
      const dashData = await dashRes.json();
      setAssessments(dashData.assessments || []);
      setStats(dashData.stats);

      setLoading(false);
    } catch (error) { console.error("Load error:", error); router.push("/admin/login"); }
  };

  const handleLogout = async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/admin/login"); };
  const handleCreateTrainer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      const res = await fetch("/api/super-admin/trainers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: newTrainerEmail, name: newTrainerName, password: newTrainerPassword }) });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || "Failed to create trainer"); setCreating(false); return; }
      setShowCreateForm(false); setNewTrainerEmail(""); setNewTrainerName(""); setNewTrainerPassword(""); setCreating(false); loadData();
    } catch (error) { setCreateError("An error occurred"); setCreating(false); }
  };
  const handleToggleTrainer = async (id: string, isActive: boolean) => { try { await fetch(`/api/super-admin/trainers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_active: !isActive }) }); loadData(); } catch (error) { console.error("Toggle trainer error:", error); } };
  const handleDeleteTrainer = async (id: string) => { if (!confirm("Are you sure you want to deactivate this trainer?")) return; try { await fetch(`/api/super-admin/trainers/${id}`, { method: "DELETE" }); loadData(); } catch (error) { console.error("Delete trainer error:", error); } };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b"><div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between"><h1 className="text-xl font-bold">Super Admin Dashboard</h1><div className="flex items-center gap-4"><span className="text-sm text-black/60">{admin?.name} ({admin?.email})</span><Button variant="ghost" onClick={handleLogout}>Logout</Button></div></div></div>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {stats && <div className="grid grid-cols-4 gap-4"><Card title="Total Assessments"><div className="text-3xl font-bold">{stats.total}</div></Card><Card title="Submitted"><div className="text-3xl font-bold text-green-600">{stats.submitted}</div></Card><Card title="In Progress"><div className="text-3xl font-bold text-orange-600">{stats.in_progress}</div></Card><Card title="AI Evaluated"><div className="text-3xl font-bold text-blue-600">{stats.evaluated}</div></Card></div>}
        <Card title="Trainers" right={<Button onClick={() => setShowCreateForm(!showCreateForm)}>{showCreateForm ? "Cancel" : "+ Add Trainer"}</Button>}>
          {showCreateForm && <form onSubmit={handleCreateTrainer} className="mb-4 p-4 border border-black/10 rounded-lg space-y-3">{createError && <div className="text-sm text-red-600">{createError}</div>}<Input placeholder="Email" value={newTrainerEmail} onChange={(e) => setNewTrainerEmail(e.target.value)} required /><Input placeholder="Name" value={newTrainerName} onChange={(e) => setNewTrainerName(e.target.value)} required /><Input type="password" placeholder="Password (min 6 chars)" value={newTrainerPassword} onChange={(e) => setNewTrainerPassword(e.target.value)} required /><Button type="submit" disabled={creating}>{creating ? "Creating..." : "Create Trainer"}</Button></form>}
          <div className="space-y-2">{trainers.map((trainer) => <div key={trainer.id} className="flex items-center justify-between p-3 border border-black/10 rounded-lg"><div><div className="font-medium">{trainer.name}</div><div className="text-sm text-black/60">{trainer.email}</div></div><div className="flex items-center gap-2"><span className={`text-xs px-2 py-1 rounded ${trainer.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{trainer.is_active ? "Active" : "Inactive"}</span><Button variant="ghost" onClick={() => handleToggleTrainer(trainer.id, trainer.is_active)}>{trainer.is_active ? "Deactivate" : "Activate"}</Button><Button variant="ghost" onClick={() => handleDeleteTrainer(trainer.id)}>Delete</Button></div></div>)}</div>
        </Card>
        <Card title="All Assessments" right={<select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded border border-black/10 px-3 py-1 text-sm"><option value="recent">Recent First</option><option value="high_score">High Score First</option><option value="low_score">Low Score First</option><option value="submitted">Submitted Only</option></select>}>
          <div className="space-y-2">{assessments.map((assessment) => { const score = assessment.ai_evaluations?.overall?.overallScore0to100; return <div key={assessment.id} className="flex items-center justify-between p-3 border border-black/10 rounded-lg hover:bg-black/5 cursor-pointer" onClick={() => router.push(`/trainer/${assessment.id}`)}><div className="flex-1"><div className="font-medium">{assessment.admin_label || "Unnamed Assessment"}</div><div className="text-xs text-black/60">Created by: {assessment.creator?.name || "Unknown"} | Status: {assessment.status} | Created: {new Date(assessment.created_at).toLocaleDateString()}</div></div>{score !== undefined && <div className="text-right"><div className="text-2xl font-bold">{score}/100</div><div className="text-xs text-black/60">AI Score</div></div>}</div>; })}</div>
        </Card>
      </div>
    </div>
  );
}
