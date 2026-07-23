export default function DemandsLoading() {
  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 rounded-lg bg-zinc-800 animate-pulse" />
          <div className="h-10 w-32 rounded-xl bg-zinc-800 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3">
              <div className="h-5 w-3/4 rounded bg-zinc-800 animate-pulse" />
              <div className="h-4 w-full rounded bg-zinc-800 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-zinc-800 animate-pulse" />
              <div className="flex gap-2">
                <div className="h-6 w-20 rounded-full bg-zinc-800 animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-zinc-800 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
