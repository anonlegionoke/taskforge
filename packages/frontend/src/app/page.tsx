"use client";

import useSWR from "swr";
import { useState } from "react";
import { Play, Flame, CheckCircle, XCircle, Clock, ServerCog, Activity } from "lucide-react";

const API_URL = process.env.API_URL;
const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLUMNS = [
  { id: "PENDING", label: "Pending", icon: Clock, color: "text-slate-400", bg: "bg-slate-900", border: "border-slate-800" },
  { id: "PROCESSING", label: "Running", icon: ServerCog, color: "text-amber-400", bg: "bg-amber-950/30", border: "border-amber-900/50" },
  { id: "COMPLETED", label: "Completed", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-900/50" },
  { id: "FAILED", label: "Failed", icon: XCircle, color: "text-rose-400", bg: "bg-rose-950/30", border: "border-rose-900/50" },
];

export default function Dashboard() {
  const { data: stats, mutate: mutateStats } = useSWR(`${API_URL}/jobs/stats`, fetcher, { refreshInterval: 1000 });
  const { data: jobs, mutate: mutateJobs } = useSWR(`${API_URL}/jobs`, fetcher, { refreshInterval: 1000 });
  const [isSpawning, setIsSpawning] = useState(false);

  const spawnJob = async (count = 1) => {
    setIsSpawning(true);
    try {
      const promises = Array.from({ length: count }).map(() =>
        fetch(`${API_URL}/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "chaos_task",
            payload: { timestamp: Date.now() },
          }),
        })
      );
      await Promise.all(promises);
      mutateStats();
      mutateJobs();
    } catch (e) {
      console.error(e);
    }
    setIsSpawning(false);
  };

  return (
    <main className="min-h-screen bg-[#0f1115] text-slate-200 p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header Section */}
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">TaskForge Observer</h1>
              <p className="text-sm text-slate-400 mt-0.5">Real-time distributed queue visualization</p>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => spawnJob(1)}
              disabled={isSpawning}
              className="group relative flex items-center gap-2 px-5 py-2.5 bg-transparent border border-indigo-500 hover:bg-indigo-500/10 disabled:opacity-50 text-indigo-400 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.1)] hover:shadow-[0_0_20px_rgba(79,70,229,0.25)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Play className="w-4 h-4 relative z-10 fill-current" />
              <span className="relative z-10">Spawn 1 Job</span>
            </button>
            <button
              onClick={() => spawnJob(50)}
              disabled={isSpawning}
              className="group relative flex items-center gap-2 px-5 py-2.5 bg-transparent border border-rose-500 hover:bg-rose-500/10 disabled:opacity-50 text-rose-400 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(225,29,72,0.1)] hover:shadow-[0_0_20px_rgba(225,29,72,0.25)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-rose-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Flame className="w-4 h-4 relative z-10 animate-pulse fill-current" />
              <span className="relative z-10">Chaos: Spawn 50</span>
            </button>
          </div>
        </header>

        {/* Stats Section */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {COLUMNS.map((col) => (
            <div key={col.id} className="bg-[#181b21] border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-sm font-medium text-slate-400">{col.label}</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {stats ? stats[col.id] || 0 : "..."}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${col.bg}`}>
                <col.icon className={`w-6 h-6 ${col.color}`} />
              </div>
            </div>
          ))}
        </section>

        {/* Kanban Board Section */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 h-[calc(100vh-320px)] min-h-[500px]">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex flex-col bg-[#14171c] rounded-xl border border-slate-800/60 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-4 border-b border-slate-800/60 bg-[#181b21]">
                <div className="flex items-center gap-2">
                  <col.icon className={`w-4 h-4 ${col.color}`} />
                  <h2 className="text-sm font-semibold text-slate-200">{col.label}</h2>
                </div>
                <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                  {jobs ? jobs.filter((j: any) => j.status === col.id).length : 0}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {jobs &&
                  jobs
                    .filter((job: any) => job.status === col.id)
                    .map((job: any) => (
                      <div
                        key={job.id}
                        className={`group relative bg-[#181b21] p-4 rounded-lg border ${col.border} shadow-sm transition-all hover:border-slate-600 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-mono text-slate-400 truncate w-24" title={job.id}>
                            {job.id.split("-")[0]}
                          </span>
                          {job.attempts > 0 && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              Try {job.attempts}/{job.max_attempts}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-medium text-slate-200 truncate">
                          {job.type}
                        </h3>
                        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                          <Clock className="w-3 h-3" />
                          {new Date(job.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                {!jobs && (
                  <div className="text-center py-8 text-sm text-slate-600">Loading...</div>
                )}
                {jobs && jobs.filter((j: any) => j.status === col.id).length === 0 && (
                  <div className="text-center py-8 text-sm text-slate-600">No jobs</div>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}