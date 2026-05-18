"use client";

import useSWR from "swr";
import { useState, useEffect } from "react";
import {
  Play,
  Flame,
  CheckCircle,
  XCircle,
  Clock,
  ServerCog,
  Activity,
  ListChecks,
  X,
  type LucideIcon,
} from "lucide-react";

type JobStatus = "PENDING" | "PROCESSING" | "RUNNING" | "COMPLETED" | "FAILED";

type JobStats = Record<JobStatus, number>;

interface JobRecord {
  id: string;
  type: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  payload: any;
  locked_by: string | null;
  locked_at: string | null;
  run_at: string;
  created_at: string;
  updated_at: string;
}

interface JobLog {
  event_type: string;
  error_message: string | null;
  worker_id: string;
  created_at: string;
}

interface JobColumn {
  id: JobStatus;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
const fetcher = async (url: string) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return response.json();
};

const COLUMNS: JobColumn[] = [
  { id: "PENDING", label: "Pending", icon: Clock, color: "text-slate-400", bg: "bg-slate-900", border: "border-slate-800" },
  { id: "PROCESSING", label: "Queued", icon: ListChecks, color: "text-sky-400", bg: "bg-sky-950/30", border: "border-sky-900/50" },
  { id: "RUNNING", label: "Running", icon: ServerCog, color: "text-amber-400", bg: "bg-amber-950/30", border: "border-amber-900/50" },
  { id: "COMPLETED", label: "Completed", icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-900/50" },
  { id: "FAILED", label: "Failed", icon: XCircle, color: "text-rose-400", bg: "bg-rose-950/30", border: "border-rose-900/50" },
];

function JobDetailsModal({ job, onClose }: { job: JobRecord; onClose: () => void }) {
  const isLive = ["PENDING", "PROCESSING", "RUNNING"].includes(job.status);
  const { data: logs } = useSWR<JobLog[]>(
    `${API_URL}/jobs/${job.id}/logs`,
    fetcher,
    { refreshInterval: isLive ? 1000 : 0 }
  );

  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (job.status !== "PENDING" || !job.run_at) return;

    const runAt = new Date(job.run_at).getTime();
    
    const updateTimer = () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((runAt - now) / 1000));
      setTimeLeft(diff);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [job.status, job.run_at]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#14171c] border border-slate-800 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-[#181b21]">
          <div>
            <h2 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
              Job Details
              <span className="text-xs font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                {job.id}
              </span>
            </h2>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[#181b21] p-3 rounded-lg border border-slate-800/60">
              <p className="text-xs text-slate-500 mb-1">Status</p>
              <p className="text-sm font-medium text-slate-300">{job.status}</p>
            </div>
            <div className="bg-[#181b21] p-3 rounded-lg border border-slate-800/60">
              <p className="text-xs text-slate-500 mb-1">Type</p>
              <p className="text-sm font-medium text-slate-300">{job.type}</p>
            </div>
            <div className="bg-[#181b21] p-3 rounded-lg border border-slate-800/60">
              <p className="text-xs text-slate-500 mb-1">Attempts</p>
              <p className="text-sm font-medium text-slate-300">{job.attempts} / {job.max_attempts}</p>
            </div>
            <div className="bg-[#181b21] p-3 rounded-lg border border-slate-800/60">
              <p className="text-xs text-slate-500 mb-1">Locked By</p>
              <p className="text-sm font-medium text-slate-300 truncate" title={job.locked_by ?? "None"}>{job.locked_by ?? "None"}</p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2">Payload</h3>
            <pre className="bg-[#0f1115] border border-slate-800 p-3 rounded-lg text-xs font-mono text-slate-300 overflow-x-auto">
              {JSON.stringify(job.payload, null, 2)}
            </pre>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-400 mb-2 flex items-center justify-between">
              Execution Logs
              <div className="flex items-center gap-3">
                {job.status === "PENDING" && timeLeft > 0 && job.attempts > 0 && (
                  <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                    Retrying in {timeLeft}s
                  </span>
                )}
                {job.status === "PENDING" && timeLeft > 0 && job.attempts === 0 && (
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                    Runs in {timeLeft}s
                  </span>
                )}
                {isLive && (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Live
                  </span>
                )}
              </div>
            </h3>
            
            <div className="bg-[#0f1115] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
              {!logs ? (
                <div className="p-4 text-sm text-slate-500 text-center">Loading logs...</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-sm text-slate-500 text-center">No logs available for this job yet.</div>
              ) : (
                <div className="divide-y divide-slate-800/50 max-h-60 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="p-3 text-sm flex flex-col gap-1 hover:bg-[#181b21] transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            log.event_type === "ERROR" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                            log.event_type === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          }`}>
                            {log.event_type}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-600 font-mono truncate max-w-[150px]" title={log.worker_id}>
                          {log.worker_id}
                        </span>
                      </div>
                      {log.error_message && (
                        <div className="mt-1 text-xs text-rose-400 font-mono bg-rose-500/5 p-2 rounded border border-rose-500/10 break-all">
                          {log.error_message}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, mutate: mutateStats } = useSWR<JobStats>(`${API_URL}/jobs/stats`, fetcher, { refreshInterval: 1000 });
  const { data: jobs, mutate: mutateJobs } = useSWR<JobRecord[]>(`${API_URL}/jobs`, fetcher, { refreshInterval: 1000 });
  const [isSpawning, setIsSpawning] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const jobList = jobs ?? [];
  const activeJob = selectedJobId ? jobList.find(j => j.id === selectedJobId) : null;

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
      {activeJob && (
        <JobDetailsModal job={activeJob} onClose={() => setSelectedJobId(null)} />
      )}
      <div className="max-w-[1400px] mx-auto space-y-8">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0">
              <Activity className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">TaskForge Observer</h1>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">Real-time distributed queue visualization</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 md:gap-4 w-full md:w-auto">
            <button
              onClick={() => spawnJob(1)}
              disabled={isSpawning}
              className="w-full sm:w-40 justify-center group relative flex items-center gap-2 px-5 py-2.5 bg-transparent border border-indigo-500 hover:bg-indigo-500/10 disabled:opacity-50 text-indigo-400 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(79,70,229,0.1)] hover:shadow-[0_0_20px_rgba(79,70,229,0.25)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-indigo-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Play className="w-4 h-4 relative z-10 fill-current" />
              <span className="relative z-10">Spawn 1 Job</span>
            </button>
            <button
              onClick={() => spawnJob(50)}
              disabled={isSpawning}
              className="w-full sm:w-40 justify-center group relative flex items-center gap-2 px-5 py-2.5 bg-transparent border border-rose-500 hover:bg-rose-500/10 disabled:opacity-50 text-rose-400 rounded-lg text-sm font-semibold transition-all shadow-[0_0_15px_rgba(225,29,72,0.1)] hover:shadow-[0_0_20px_rgba(225,29,72,0.25)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-rose-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
              <Flame className="w-4 h-4 relative z-10 animate-pulse fill-current" />
              <span className="relative z-10">Chaos: Spawn 50</span>
            </button>
          </div>
        </header>

        {/* Stats Section */}
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {COLUMNS.map((col) => {
            const Icon = col.icon;

            return (
              <div 
                key={col.id}
                onClick={() => {
                  document.getElementById(`col-${col.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                className="bg-[#181b21] cursor-pointer hover:border-slate-600 transition-colors border border-slate-800 rounded-xl p-5 flex items-center justify-between shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium text-slate-400">{col.label}</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {stats ? stats[col.id] || 0 : "..."}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${col.bg}`}>
                  <Icon className={`w-6 h-6 ${col.color}`} />
                </div>
              </div>
            );
          })}
        </section>

        {/* Kanban Board Section */}
        <section className="flex md:grid md:grid-cols-5 gap-4 md:gap-6 pt-4 h-[calc(100vh-320px)] min-h-[500px] overflow-x-auto pb-6 snap-x snap-mandatory">
          {COLUMNS.map((col) => {
            const Icon = col.icon;
            const columnJobs = jobList.filter((job) => job.status === col.id);

            return (
              <div id={`col-${col.id}`} key={col.id} className="flex flex-col shrink-0 w-[85vw] sm:w-[320px] md:w-auto snap-center bg-[#14171c] rounded-xl border border-slate-800/60 overflow-hidden shadow-sm">
                <div className="flex items-center justify-between p-4 border-b border-slate-800/60 bg-[#181b21]">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${col.color}`} />
                    <h2 className="text-sm font-semibold text-slate-200">{col.label}</h2>
                  </div>
                  <span className="text-xs font-medium bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                    {columnJobs.length}
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {columnJobs.map((job) => (
                    <div
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`group cursor-pointer relative bg-[#181b21] p-4 rounded-lg border ${col.border} shadow-sm transition-all hover:border-slate-500 hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-300`}
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
                  {jobs && columnJobs.length === 0 && (
                    <div className="text-center py-8 text-sm text-slate-600">No jobs</div>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
