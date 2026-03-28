// Loading UI for route segment /dashboard.
export default function DashboardLoading() {
  return (
    <div className="space-y-3">
      <div className="h-7 w-44 animate-pulse rounded bg-primary/10" />
      <div className="h-4 w-72 animate-pulse rounded bg-primary/10" />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="h-28 animate-pulse rounded-2xl bg-primary/10" />
        <div className="h-28 animate-pulse rounded-2xl bg-primary/10" />
      </div>
    </div>
  );
}
