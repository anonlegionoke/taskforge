import Link from 'next/link';
import Image from 'next/image';
import {
  Terminal,
  GitBranch,
  Activity,
  ShieldAlert,
  ShieldCogCorner,
  ArrowRight,
  Server,
  Layers,
  Play,
  Flame,
  RefreshCw,
  Code,
  Database,
  Container,
  HeartPulse,
  PanelsTopLeft
} from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0f1115] text-slate-200 font-sans overflow-x-hidden relative selection:bg-indigo-500/30 pb-24">
      {/* Background Gradients (Fixed & GPU accelerated to prevent scroll jank) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none opacity-50 transform-gpu"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none transform-gpu"></div>
      <div className="fixed top-[30%] right-[-10%] w-[400px] h-[400px] bg-rose-500/5 blur-[100px] rounded-full pointer-events-none transform-gpu"></div>

      {/* Hero Section */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-12 flex flex-col items-center justify-center text-center">

        {/* Hero Logo */}
        <div className="mb-6 animate-in fade-in duration-700 relative">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full"></div>
          <Image
            src="/logo.svg"
            alt="TaskForge Logo"
            width={90}
            height={90}
            className="relative drop-shadow-2xl"
          />
        </div>

        <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 mb-6 pb-2">
          TaskForge
        </h1>

        <p className="max-w-3xl text-lg md:text-xl text-slate-400 mb-10 leading-relaxed">
          A production-grade, distributed job scheduler built to demonstrate resilient backend systems architecture and real-time dashboard tracking.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
          <Link
            href="/console"
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 w-full sm:w-auto text-sm font-semibold text-white bg-[#1F5FA9] hover:bg-[#1b5394] rounded-xl transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(31,95,169,0.4)] active:scale-95"
          >
            <Terminal className="w-5 h-5 relative z-10" />
            <span className="relative z-10">Launch Console</span>
            <ArrowRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="https://github.com/anonlegionoke/taskforge"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-3.5 w-full sm:w-auto text-sm font-semibold text-slate-300 bg-[#181b21]/80 backdrop-blur-md border border-slate-700/50 rounded-xl transition-all hover:bg-slate-800 hover:text-white hover:border-slate-600 active:scale-95"
          >
            <GitBranch className="w-5 h-5 transition-transform group-hover:scale-110" />
            <span>View on GitHub</span>
          </Link>
        </div>
      </div>

      {/* Chaos Demo Workflow section */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 mt-16">
        <div className="bg-[#14171c]/40 border border-slate-800/80 backdrop-blur-md rounded-3xl p-8 md:p-12">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Try the &quot;Chaos Demo&quot;</h2>
            <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
              TaskForge was built to be broken. Use the Observer dashboard to simulate crashes and see real-time resilience in action.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            {[
              {
                step: "1",
                icon: Play,
                title: "Spawn Jobs",
                desc: "Spawn 1 or 50 tasks to flood the system with jobs, flowing from Queued to Running to Completed.",
                color: "text-indigo-400",
                bg: "bg-indigo-500/10",
                border: "border-indigo-500/20"
              },
              {
                step: "2",
                icon: Flame,
                title: "Kill Worker",
                desc: "Inject a fatal crash into the Node.js worker process to simulate an ungraceful shutdown.",
                color: "text-red-400",
                bg: "bg-red-500/10",
                border: "border-red-500/20"
              },
              {
                step: "3",
                icon: Activity,
                title: "Observe Degraded State",
                desc: "Watch the dashboard Health Indicator instantly flip to Degraded as heartbeats halt.",
                color: "text-rose-400",
                bg: "bg-rose-500/10",
                border: "border-rose-500/20"
              },
              {
                step: "4",
                icon: RefreshCw,
                title: "Auto-Recovery",
                desc: "The Scheduler sweeps the DB, breaks stale locks, and re-queues jobs automatically.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
                border: "border-emerald-500/20"
              }
            ].map((step, idx) => (
              <div key={idx} className="flex flex-col items-center md:items-start text-center md:text-left relative">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2.5 rounded-xl ${step.bg} ${step.border} border`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                  <span className="text-xs font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700">
                    Step {step.step}
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-200 mb-1">{step.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Key Features Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-12">Core Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Server,
              title: "Distributed Execution",
              desc: "Horizontally scalable Node.js worker pool leveraging RabbitMQ for reliable message distribution.",
              color: "text-indigo-400",
              bg: "bg-indigo-500/10",
              border: "border-indigo-500/20"
            },
            {
              icon: ShieldAlert,
              title: "Resilience & Chaos Engineering",
              desc: "Built-in 'Kill Worker' fault-injection to demonstrate automatic recovery from ungraceful shutdowns.",
              color: "text-red-400",
              bg: "bg-red-500/10",
              border: "border-red-500/20"
            },
            {
              icon: Activity,
              title: "Real-Time Tracking",
              desc: "Next.js frontend using high-frequency SWR short-polling to render a responsive Kanban view.",
              color: "text-emerald-400",
              bg: "bg-emerald-500/10",
              border: "border-emerald-500/20"
            },
            {
              icon: ShieldCogCorner,
              title: "Execution Guarantees",
              desc: "At-Least-Once execution guarantees with best-effort FIFO chronological ordering and backoff policies.",
              color: "text-amber-400",
              bg: "bg-amber-500/10",
              border: "border-amber-500/20"
            },
            {
              icon: Terminal,
              title: "Global Event Console",
              desc: "Centralized polling logs capturing every event across the API, Scheduler, and Worker nodes.",
              color: "text-cyan-400",
              bg: "bg-cyan-500/10",
              border: "border-cyan-500/20"
            },
            {
              icon: HeartPulse,
              title: "Live System Health",
              desc: "Continuous system diagnostics on PostgreSQL, RabbitMQ, and Worker nodes with dynamic UI indicators.",
              color: "text-rose-400",
              bg: "bg-rose-500/10",
              border: "border-rose-500/20"
            }
          ].map((feat, i) => (
            <div key={i} className="bg-[#14171c]/50 backdrop-blur-sm border border-slate-800/50 p-6 rounded-2xl flex flex-col items-center md:items-start text-center md:text-left transition-all hover:-translate-y-1 hover:border-slate-700">
              <div className={`p-3 rounded-xl mb-4 ${feat.bg} ${feat.border} border`}>
                <feat.icon className={`w-5 h-5 ${feat.color}`} />
              </div>
              <h3 className="text-base font-semibold text-slate-200 mb-2">{feat.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{feat.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack Grid */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 mt-20">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-white mb-10">System Architecture Tech Stack</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
          {[
            { name: "Node.js & Express", role: "API Service", icon: Server },
            { name: "TypeScript", role: "Type Safety", icon: Code },
            { name: "PostgreSQL", role: "Source of Truth", icon: Database },
            { name: "RabbitMQ", role: "Message Broker", icon: Layers },
            { name: "Next.js", role: "Frontend UI", icon: PanelsTopLeft },
            { name: "Docker Compose", role: "Infrastructure", icon: Container }
          ].map((tech, idx) => (
            <div key={idx} className="bg-[#14171c]/30 border border-slate-800/50 p-4 rounded-xl flex flex-col items-center text-center">
              <tech.icon className="w-5 h-5 text-slate-400 mb-2" />
              <div className="text-xs font-semibold text-slate-200">{tech.name}</div>
              <div className="text-[10px] text-slate-500 mt-1">{tech.role}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
