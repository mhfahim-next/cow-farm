'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Leaf, ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
export default function Login() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <main className="min-h-screen grid lg:grid-cols-2">
      <section className="hidden lg:flex bg-[#123b2e] text-white p-16 flex-col justify-between farm-grid">
        <div className="flex items-center gap-3 text-xl font-semibold">
          <Leaf className="text-lime-300" /> Fahim Agro
        </div>
        <div>
          <p className="text-lime-300 text-sm tracking-[.2em] uppercase mb-6">
            Your farm, well cared for
          </p>
          <h1 className="farm-heading text-6xl leading-tight max-w-lg">
            Every cow.
            <br />
            Every milestone.
            <br />
            One place.
          </h1>
          <p className="text-green-100/75 mt-7 text-lg max-w-md">
            Keep a clear record of breeding, health, and the work that keeps your herd thriving.
          </p>
        </div>
        <p className="text-sm text-green-100/65">Cow farm management · Bangladesh</p>
      </section>
      <section className="flex items-center justify-center p-7 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex gap-2 items-center text-primary font-bold text-xl mb-12">
            <Leaf />
            Fahim Agro
          </div>
          <div className="h-12 w-12 rounded-xl bg-secondary text-primary grid place-items-center mb-7">
            <ShieldCheck />
          </div>
          <h2 className="farm-heading text-4xl mb-3">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to manage your cow farm.</p>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              const f = new FormData(e.currentTarget);
              try {
                await api('/api/session', {
                  method: 'POST',
                  body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
                });
                router.replace('/dashboard');
                router.refresh();
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-12"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive bg-red-50 rounded-lg p-3">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full h-12">
              {busy ? <Loader2 className="animate-spin" /> : null}Sign in{' '}
              <ArrowRight className="ml-auto" />
            </Button>
          </form>
          <p className="text-sm text-muted-foreground mt-7">
            Use the owner account you created during database setup. Staff accounts are created by
            the owner.
          </p>
        </div>
      </section>
    </main>
  );
}
