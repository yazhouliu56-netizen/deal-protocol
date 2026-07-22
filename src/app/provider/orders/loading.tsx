import { Skeleton } from "@/components/ui/Skeleton"

export default function Loading() {
  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  )
}
