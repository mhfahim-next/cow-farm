'use client';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="p-10">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted-foreground">
        Please retry. If it continues, check that PostgreSQL is running.
      </p>
      <button className="mt-5 rounded-lg bg-primary text-white px-5 py-3" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
