// Global loading UI while server components are being prepared.
export default function RootLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-6 md:py-10">
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-56 rounded bg-primary/10" />
        <div className="h-4 w-80 rounded bg-primary/10" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-24 rounded-2xl bg-primary/10" />
          <div className="h-24 rounded-2xl bg-primary/10" />
          <div className="h-24 rounded-2xl bg-primary/10" />
        </div>
      </div>
    </div>
  );
}
