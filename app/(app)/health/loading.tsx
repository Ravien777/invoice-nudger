export default function HealthLoading() {
  return (
    <div className="animate-pulse space-y-8 p-8">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-surface-muted rounded" />
        <div className="h-10 w-48 bg-surface-muted rounded" />
      </div>
      <div className="flex items-center justify-center">
        <div className="h-48 w-48 rounded-full bg-surface-muted" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-surface-muted" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-surface-muted" />
    </div>
  );
}
