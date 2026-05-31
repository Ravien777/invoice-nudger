export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-8 p-8">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-surface-muted rounded" />
        <div className="h-10 w-64 bg-surface-muted rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-muted" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-32 rounded-xl bg-surface-muted" />
        <div className="h-32 rounded-xl bg-surface-muted" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-64 rounded-xl bg-surface-muted" />
        <div className="h-64 rounded-xl bg-surface-muted" />
      </div>
      <div className="h-48 rounded-xl bg-surface-muted" />
    </div>
  );
}
