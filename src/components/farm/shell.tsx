'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Beef,
  HeartPulse,
  CalendarCheck,
  GitBranch,
  Users,
  Leaf,
  LogOut,
  Menu,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { api, useResource } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
const UserContext = createContext<User | null>(null);
export const useUser = () => useContext(UserContext)!;
export const useCanManage = () => useUser()?.role !== 'WORKER';
const navigation = [
  { href: '/dashboard', name: 'Overview', icon: LayoutDashboard },
  { href: '/cows', name: 'My cattle', icon: Beef },
  { href: '/breeding', name: 'Breeding & pregnancy', icon: GitBranch },
  { href: '/health', name: 'Health records', icon: HeartPulse },
  { href: '/tasks', name: 'Tasks & schedule', icon: CalendarCheck },
  { href: '/staff', name: 'Farm team', icon: Users },
];
export function FarmShell({ children }: { children: React.ReactNode }) {
  const session = useResource<User>('/api/session');
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  useEffect(() => {
    const out = () => router.replace('/login');
    window.addEventListener('farm:unauthorized', out);
    return () => window.removeEventListener('farm:unauthorized', out);
  }, [router]);
  useEffect(() => {
    if (
      session.error === 'Please sign in' ||
      session.error === 'Invalid or expired token' ||
      session.error === 'Account unavailable'
    )
      router.replace('/login');
  }, [session.error, router]);
  const nav = (
    <>
      <Link
        href="/dashboard"
        className="flex items-center gap-3 p-6 text-white font-semibold text-xl"
      >
        <span className="bg-[#d4ee99] p-2 rounded-lg text-[#123b2e]">
          <Leaf size={21} />
        </span>
        Fahim Agro
      </Link>
      <p className="text-green-100/50 px-6 text-xs uppercase tracking-[.18em] mt-6 mb-4">
        Cow farm workspace
      </p>
      <nav className="px-3 flex-1 space-y-1">
        {navigation
          .filter((n) => n.href !== '/staff' || session.data?.role === 'OWNER')
          .map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cn(
                'flex gap-3 items-center px-3 py-3 rounded-lg text-sm transition-colors',
                pathname.startsWith(n.href)
                  ? 'bg-white/12 text-white font-semibold'
                  : 'text-green-100/70 hover:text-white hover:bg-white/5',
              )}
            >
              <n.icon size={19} />
              {n.name}
              {pathname.startsWith(n.href) && <ChevronRight size={15} className="ml-auto" />}
            </Link>
          ))}
      </nav>
      <div className="p-5 border-t border-white/10">
        <div className="flex gap-3 items-center mb-4">
          <span className="size-9 rounded-full bg-white/10 text-lime-200 grid place-items-center font-bold">
            {session.data?.name.slice(0, 1)}
          </span>
          <div className="min-w-0">
            <p className="text-white text-sm truncate">{session.data?.name}</p>
            <p className="text-green-100/50 text-xs capitalize">
              {session.data?.role.toLowerCase()}
            </p>
          </div>
        </div>
        <button
          className="text-sm text-green-100/70 flex gap-2 items-center hover:text-white"
          onClick={async () => {
            try {
              await fetch('/api/session', { method: 'DELETE' }).then((r) => {
                if (!r.ok) throw new Error('Could not sign out. Try again.');
              });
              router.replace('/login');
              router.refresh();
            } catch (e) {
              setLogoutError((e as Error).message);
            }
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
        {logoutError && (
          <p role="alert" className="text-red-200 text-sm mt-2">
            {logoutError}
          </p>
        )}
      </div>
    </>
  );
  if (!session.data)
    return (
      <main className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md text-center">
          <Leaf className="mx-auto text-primary mb-4" />
          {session.error ? (
            <>
              <p role="alert">{session.error}</p>
              <Button onClick={session.refresh} className="mt-4">
                Try again
              </Button>
              <Button variant="link" asChild>
                <Link href="/login">Back to sign in</Link>
              </Button>
            </>
          ) : (
            <p className="text-muted-foreground">Opening your farm…</p>
          )}
        </div>
      </main>
    );
  return (
    <UserContext.Provider value={session.data}>
      <div className="min-h-screen">
        <aside className="fixed hidden lg:flex flex-col inset-y-0 left-0 w-64 bg-[#123b2e] z-30">
          {nav}
        </aside>
        <div className="lg:pl-64">
          <header className="h-18 border-b bg-white flex items-center justify-between px-5 sm:px-9 gap-3">
            <div className="flex items-center gap-3">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button
                    className="lg:hidden"
                    variant="outline"
                    size="icon"
                    aria-label="Open navigation"
                  >
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="w-72 p-0 bg-[#123b2e] text-white border-0 flex flex-col"
                >
                  <SheetTitle className="sr-only">Farm navigation</SheetTitle>
                  <SheetDescription className="sr-only">
                    Navigate your cow farm records
                  </SheetDescription>
                  {nav}
                </SheetContent>
              </Sheet>
              <span className="text-sm text-muted-foreground">Farm management</span>
              <ChevronRight size={14} className="text-muted-foreground" />
              <span className="text-sm font-medium">
                {navigation.find((n) => pathname.startsWith(n.href))?.name || 'Cow profile'}
              </span>
            </div>
            <span className="text-sm text-muted-foreground hidden sm:block">Bangladesh · BDT</span>
          </header>
          <main id="main" className="p-5 sm:p-9 max-w-[1600px] mx-auto">
            {children}
          </main>
          <footer className="px-9 pb-6 text-xs text-muted-foreground">
            Fahim Agro · Records displayed in Bangladesh time
          </footer>
        </div>
      </div>
    </UserContext.Provider>
  );
}
