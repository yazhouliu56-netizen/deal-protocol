import { Skeleton } from "@/components/ui/Skeleton"

export default function OrderFulfillmentLoading() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  )
}
