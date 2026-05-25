"use client";

import useSWR from "swr";
import { useState, useEffect } from "react";
import Image from "next/image";
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
  Terminal,
  Server,
  Database,
  ShieldAlert,
  Cpu,
  Timeline,
  type LucideIcon,
} from "lucide-react";
import type {
  JobLogRecord,
  JobRecord,
  JobStats,
  JobStatus,
  SystemHealth,
  SystemLogRecord,
} from "@taskforge/shared";

interface JobColumn {
  id: JobStatus;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error("FATAL: NEXT_PUBLIC_API_URL environment variable is missing.");
}
const API_URL = process.env.NEXT_PUBLIC_API_URL;

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
  const { data: logs } = useSWR<JobLogRecord[]>(
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
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${log.event_type === "ERROR" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" :
                              log.event_type === "SUCCESS" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            }`}>
                            {log.event_type}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(log.created_at).toLocaleString()}
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
  const [showConsole, setShowConsole] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const jobList = jobs ?? [];
  const activeJob = selectedJobId ? jobList.find(j => j.id === selectedJobId) : null;

  const { data: health, error: healthError } = useSWR<SystemHealth>(`${API_URL}/system/health`, fetcher, { refreshInterval: 2000 });
  const { data: logs } = useSWR<SystemLogRecord[]>(showConsole ? `${API_URL}/system/logs` : null, fetcher, { refreshInterval: 1000 });

  const isHealthy = healthError ? false : health ? (health.api === "UP" && health.db === "UP" && health.rabbitmq === "UP" && health.worker === "UP" && health.scheduler === "UP") : true;
  const isUp = (status?: string) => !healthError && status === "UP";

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

  const crashWorker = async () => {
    setIsSpawning(true);
    try {
      await fetch(`${API_URL}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chaos_crash_worker", payload: { simulate: "ungraceful_kill" }, max_attempts: 1 }),
      });
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
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-6 relative">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="TaskForge Logo" width={48} height={48} className="w-10 h-10 md:w-12 md:h-12 shrink-0 drop-shadow-md shadow-black/20" />
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white">TaskForge Observer</h1>
              <p className="text-xs md:text-sm text-slate-400 mt-0.5">Real-time distributed queue visualization</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-start md:justify-end gap-3 md:gap-4 w-full md:w-auto relative">
            <div className="grid grid-cols-2 gap-3 md:flex md:gap-4 w-full md:w-auto relative">
              <button
                onClick={() => { setShowConsole(!showConsole); setShowHealth(false); }}
                className={`w-full md:w-auto justify-center group relative flex items-center gap-2 px-4 py-2.5 border text-sm font-medium transition-all shadow-sm rounded-lg ${showConsole ? 'bg-slate-800 border-slate-600 text-white' : 'bg-[#181b21] hover:bg-slate-800 border-slate-700 text-slate-300'}`}
              >
                <Terminal className={`w-4 h-4 transition-colors ${showConsole ? 'text-indigo-400' : 'text-slate-400 group-hover:text-white'}`} />
                Console
              </button>
              <button
                onClick={() => { setShowHealth(!showHealth); setShowConsole(false); }}
                className={`w-full md:w-auto justify-center group relative flex items-center gap-2 px-4 py-2.5 border text-sm font-medium transition-all shadow-sm rounded-lg ${showHealth ? 'bg-slate-800 border-slate-600 text-white' : 'bg-[#181b21] hover:bg-slate-800 border-slate-700 text-slate-300'}`}
              >
                <div className="relative">
                  <Activity className={`w-4 h-4 ${isHealthy ? 'text-emerald-400' : 'text-rose-400'}`} />
                  <span className="absolute -top-1 -right-1 flex h-2 w-2">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isHealthy ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${isHealthy ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </span>
                </div>
                Health
              </button>

              {showHealth && (
                <div className="absolute right-0 md:right-auto md:left-0 top-[110%] z-50 w-full md:w-80 bg-[#14171c] border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="p-3 border-b border-slate-800 bg-[#181b21] flex justify-between items-center">
                    <h2 className="text-sm font-semibold text-slate-200">System Diagnostics</h2>
                    {isHealthy ? (
                      <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">All Systems Go</span>
                    ) : (
                      <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded">Degraded</span>
                    )}
                  </div>
                  <div className="p-4 space-y-3">
                    {!health && !healthError ? (
                      <div className="text-slate-500 text-xs text-center animate-pulse">Running diagnostics...</div>
                    ) : (
                      <div className="space-y-2">
                        {[
                          { label: 'API Server', icon: Server, status: health?.api },
                          { label: 'PostgreSQL DB', icon: Database, status: health?.db },
                          { label: 'RabbitMQ Cluster', icon: ServerCog, status: health?.rabbitmq },
                          { label: 'Worker Node', icon: Cpu, status: health?.worker },
                          { label: 'Scheduler', icon: Timeline, status: health?.scheduler }
                        ].map(item => (
                          <div key={item.label} className="flex items-center justify-between p-3 bg-[#181b21] rounded-lg border border-slate-800/60 transition-all">
                            <div className="flex items-center gap-2">
                              <item.icon className="w-4 h-4 text-slate-400" />
                              <span className="text-sm font-medium text-slate-200">{item.label}</span>
                            </div>
                            <div className={`px-2 py-0.5 text-[10px] font-bold rounded ${isUp(item.status) ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                              {healthError ? 'DOWN' : (item.status || 'DOWN')}
                            </div>
                          </div>
                        ))}
                        <div className="text-center text-[10px] text-slate-500 mt-2 pt-2 border-t border-slate-800">
                          {health?.timestamp ? `Updated: ${new Date(health.timestamp).toLocaleString()}` : "API Offline"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 md:flex md:gap-4 w-full md:w-auto">
              <button
                onClick={crashWorker}
                disabled={isSpawning}
                className="w-full md:w-auto justify-center group relative flex items-center gap-2 px-3 py-2.5 bg-transparent border border-red-500 hover:bg-red-500/10 disabled:opacity-50 text-red-400 rounded-lg text-xs font-semibold transition-all shadow-[0_0_15px_rgba(239,68,68,0.1)] hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-red-500/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <ShieldAlert className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10 hidden sm:inline">Kill Worker</span>
                <span className="relative z-10 sm:hidden">Kill</span>
              </button>
              <button
                onClick={() => spawnJob(1)}
                disabled={isSpawning}
                className="w-full md:w-auto justify-center group relative flex items-center gap-2 px-3 py-2.5 bg-transparent border border-slate-700 hover:bg-slate-700/10 disabled:opacity-50 text-slate-400 hover:text-slate-300 rounded-lg text-xs font-semibold transition-all shadow-[0_0_10px_rgba(100,116,139,0.05)] hover:shadow-[0_0_15px_rgba(100,116,139,0.15)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-slate-700/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Play className="w-3.5 h-3.5 relative z-10 fill-current" />
                <span className="relative z-10 hidden sm:inline">Spawn 1</span>
                <span className="relative z-10 sm:hidden">+1</span>
              </button>
              <button
                onClick={() => spawnJob(50)}
                disabled={isSpawning}
                className="w-full md:w-auto justify-center group relative flex items-center gap-2 px-3 py-2.5 bg-transparent border border-slate-700 hover:bg-slate-700/10 disabled:opacity-50 text-slate-400 hover:text-slate-300 rounded-lg text-xs font-semibold transition-all shadow-[0_0_10px_rgba(100,116,139,0.05)] hover:shadow-[0_0_15px_rgba(100,116,139,0.15)] overflow-hidden"
              >
                <div className="absolute inset-0 bg-slate-700/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                <Flame className="w-3.5 h-3.5 relative z-10 fill-current" />
                <span className="relative z-10 hidden sm:inline">Chaos 50</span>
                <span className="relative z-10 sm:hidden">+50</span>
              </button>
            </div>
          </div>
        </header>

        {showConsole && (
          <div className="w-full bg-[#0c0e12] border border-slate-700 rounded-xl shadow-lg overflow-hidden flex flex-col h-64 md:h-80 animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="flex items-center justify-between p-3 border-b border-slate-800 bg-[#14171c]">
              <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                Global Console
                <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 ml-2 border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Live Stream
                </span>
              </h2>
              <button onClick={() => setShowConsole(false)} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 font-mono text-[10px] sm:text-[11px]">
              {!logs ? (
                <div className="text-slate-500">Connecting to log stream...</div>
              ) : logs.length === 0 ? (
                <div className="text-slate-500">Awaiting events...</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex flex-col sm:flex-row gap-1 sm:gap-3 hover:bg-white/5 px-2 py-0.5 rounded">
                    <span className="text-slate-500 shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                    <span className={`shrink-0 w-12 font-bold ${log.level === 'ERROR' ? 'text-rose-400' :
                        log.level === 'WARN' ? 'text-amber-400' :
                          'text-emerald-400'
                      }`}>
                      {log.level}
                    </span>
                    <span className="shrink-0 w-24 text-indigo-300 truncate" title={log.source}>
                      [{log.source}]
                    </span>
                    <span className={`break-all ${log.level === 'ERROR' ? 'text-rose-300' : 'text-slate-300'}`}>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

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
                        {new Date(job.created_at).toLocaleString()}
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
