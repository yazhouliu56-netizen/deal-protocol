export default function GrabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full mx-auto bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-3xl p-6 shadow-xl animate-pulse flex flex-col items-center text-center space-y-6 overflow-hidden">

        <div className="h-5 w-36 bg-gray-200 dark:bg-zinc-800 rounded-md" />

        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[4px] border-gray-100 dark:border-zinc-800/60" />
          <div className="h-7 w-16 bg-gray-200 dark:bg-zinc-800 rounded-md z-10" />
        </div>

        <div className="h-3 w-44 bg-gray-100 dark:bg-zinc-800/80 rounded-md" />

        <div className="w-full h-[56px] bg-gray-200 dark:bg-zinc-800 rounded-xl mt-2" />

      </div>
    </div>
  )
}
