export function SkeletonCard() {
  return (
    <div className="glass p-6 animate-pulse">
      <div className="space-y-4">
        <div className="h-6 bg-white/10 rounded w-3/4" />
        <div className="space-y-2">
          <div className="h-4 bg-white/10 rounded w-1/2" />
          <div className="h-4 bg-white/10 rounded w-2/3" />
        </div>
        <div className="h-10 bg-white/10 rounded" />
      </div>
    </div>
  )
}

export function SkeletonKPICard() {
  return (
    <div className="glass p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-white/10 rounded w-20" />
          <div className="h-8 bg-white/10 rounded w-24" />
        </div>
        <div className="w-12 h-12 bg-white/10 rounded-lg" />
      </div>
    </div>
  )
}

export function SkeletonChart() {
  return (
    <div className="glass p-6 animate-pulse">
      <div className="h-6 bg-white/10 rounded w-48 mb-6" />
      <div className="h-64 bg-white/10 rounded" />
    </div>
  )
}

