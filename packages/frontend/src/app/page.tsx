export default function Dashboard() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex items-center justify-between border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">TaskForge Observer</h1>
            <p className="text-gray-400 mt-1">Real-time distributed queue visualization</p>
          </div>
          
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-medium transition-colors">
              Spawn 1 Job
            </button>
            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-md font-medium transition-colors">
              Chaos: Spawn 50
            </button>
          </div>
        </header>

        {/* Stats Section */}
        <section className="grid grid-cols-4 gap-4">
        </section>

        {/* Kanban Board Section */}
        <section className="grid grid-cols-4 gap-6 pt-4">
        </section>

      </div>
    </main>
  );
}