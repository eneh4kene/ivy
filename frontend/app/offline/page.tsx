'use client'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-bold text-emerald-400">ivy</span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">You're offline</h1>
        <p className="text-zinc-400 text-sm mb-6">
          Ivy needs a connection to load your dashboard. Check your network and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-emerald-500 text-black text-sm font-medium rounded-lg hover:bg-emerald-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
