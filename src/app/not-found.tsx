import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center text-center p-6">
      <div>
        <h1 className="farm-heading text-4xl mb-3">Page not found</h1>
        <p className="text-muted-foreground mb-5">This page does not exist.</p>
        <Link className="text-primary underline" href="/dashboard">
          Return to your farm
        </Link>
      </div>
    </main>
  );
}
