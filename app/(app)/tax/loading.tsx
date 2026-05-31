export default function TaxLoading() {
  return (
    <div className="animate-pulse space-y-8 p-8">
      <div className="space-y-2">
        <div className="h-4 w-24 bg-surface-muted rounded" />
        <div className="h-10 w-48 bg-surface-muted rounded" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-surface-muted" />
        <div className="h-48 rounded-xl bg-surface-muted" />
      </div>
      <div className="h-64 rounded-xl bg-surface-muted" />
    </div>
  );
}
