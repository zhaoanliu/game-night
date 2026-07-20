export function Skeleton({ className = '' }: { className?: string }) {
  return <div data-testid="skeleton" className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-2 h-4 w-1/3" />
    </div>
  )
}
