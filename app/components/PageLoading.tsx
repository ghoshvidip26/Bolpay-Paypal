export function PageLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-label="Loading">
      <span className="size-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
    </div>
  );
}
