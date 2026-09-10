export default function GrabLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="max-w-md w-full mx-auto bg-white border border-gray-100 rounded-3xl p-6 shadow-xl animate-pulse flex flex-col items-center text-center space-y-6 overflow-hidden">

        <div className="h-5 w-36 bg-gray-200 rounded-md" />

        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-[4px] border-gray-100" />
          <div className="h-7 w-16 bg-gray-200 rounded-md z-10" />
        </div>

        <div className="h-3 w-44 bg-gray-100 rounded-md" />

        <div className="w-full h-[56px] bg-gray-200 rounded-xl mt-2" />

      </div>
    </div>
  )
}
