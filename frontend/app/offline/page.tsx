'use client'

export default function OfflinePage() {
  return (
    <div className="theme-vine min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-sage-400/10 border border-sage-400/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-2xl font-bold text-sage-400">ivy</span>
        </div>
        <h1 className="text-xl font-semibold text-white mb-2">You're offline</h1>
        <p className="text-ink-400 text-sm mb-6">
          Ivy needs a connection to load your dashboard. Check your network and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-sage-400 text-black text-sm font-medium rounded-lg hover:bg-sage-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
