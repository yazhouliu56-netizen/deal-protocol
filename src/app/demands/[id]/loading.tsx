import { Skeleton } from "@/components/ui/Skeleton";

/** demands/[id] 唯一异步页骨架（Batch② loading/error 矩阵；其余同步/客户端页加 loading 属死文件，不加）。 */
export default function Loading() {
  return (
    <div className="p-4 space-y-4 max-w-md mx-auto" data-testid="demand-detail-loading">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
