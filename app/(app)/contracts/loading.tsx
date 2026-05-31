export default function Loading() {
  return (
    <div className="animate-pulse space-y-6 p-8">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-surface-muted rounded" />
        <div className="h-8 w-48 bg-surface-muted rounded" />
      </div>
      <div className="h-64 rounded-xl bg-surface-muted" />
    </div>
  );
}
