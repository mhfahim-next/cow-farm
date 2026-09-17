'use client';
import Link from 'next/link';
import {
  Beef,
  Heart,
  CalendarClock,
  ArrowUpRight,
  Plus,
  ClipboardCheck,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeading, LoadState, Empty, Status } from '@/components/farm/common';
import { useResource } from '@/lib/api';
import { useUser, useCanManage } from '@/components/farm/shell';
import { displayDate, label } from '@/lib/utils';
import type { Dashboard } from '@/lib/types';
export default function DashboardPage() {
  const q = useResource<Dashboard>('dashboard');
  const user = useUser();
  const manage = useCanManage();
  return (
    <>
      <PageHeading
        title="Your farm at a glance"
        description={`Welcome back, ${user.name.split(' ')[0]}. Here’s what needs your attention.`}
        action={
          <Button asChild>
            <Link href={manage ? '/cows' : '/tasks'}>
              {manage ? <Plus /> : <ClipboardCheck />}
              {manage ? 'Manage cattle' : 'View my tasks'}
            </Link>
          </Button>
        }
      />
      <LoadState {...q} retry={q.refresh} />
      {q.data && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
            {[
              {
                title: 'Active cattle',
                value: q.data.activeCattle,
                icon: Beef,
                href: '/cows',
                caption: 'Across your farm',
              },
              {
                title: 'Confirmed pregnancies',
                value: q.data.ongoingPregnancies,
                icon: Heart,
                href: '/breeding?tab=pregnancies',
                caption: 'Ongoing, active cows',
              },
              {
                title: 'Overdue tasks',
                value: q.data.overdueTasks,
                icon: CalendarClock,
                href: '/tasks?overdue=true',
                caption: 'Waiting for completion',
              },
              {
                title: 'Due in the next 7 days',
                value: q.data.upcomingTasks.length,
                icon: ClipboardCheck,
                href: '/tasks',
                caption: 'Shown in your work list',
                capped: true,
              },
            ].map((s) => (
              <Link key={s.title} href={s.href}>
                <Card className="h-full shadow-none hover:border-primary/40 transition-colors">
                  <CardContent className="p-5">
                    <div className="flex justify-between gap-2 mb-6">
                      <p className="text-sm font-medium text-muted-foreground">{s.title}</p>
                      <s.icon size={19} className="text-primary" />
                    </div>
                    <div className="flex justify-between items-end">
                      <p className="text-4xl tracking-tight font-semibold">
                        {s.value}
                        {s.capped && s.value === 20 ? '+' : ''}
                      </p>
                      <ArrowUpRight size={17} className="text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">{s.caption}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <div className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
            <Card className="shadow-none">
              <CardHeader className="flex-row justify-between items-center">
                <CardTitle className="text-lg">Coming up this week</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/tasks">
                    All tasks
                    <ArrowRight size={15} />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {q.data.upcomingTasks.length ? (
                  <div className="divide-y">
                    {q.data.upcomingTasks.map((t) => (
                      <Link
                        key={t.id}
                        href="/tasks"
                        className="py-4 flex gap-4 items-start hover:bg-muted/40"
                      >
                        <span className="size-10 rounded-lg bg-secondary text-primary grid place-items-center shrink-0">
                          <CalendarClock size={19} />
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">{t.title}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t.cow?.tagNumber} · {displayDate(t.dueAt, true)}
                          </p>
                        </div>
                        <Status value={t.status} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="A clear week ahead"
                    description="No pending tasks are scheduled for the next seven days."
                    action={
                      <Button variant="outline" asChild>
                        <Link href="/tasks">Open schedule</Link>
                      </Button>
                    }
                  />
                )}
              </CardContent>
            </Card>
            <div className="space-y-6">
              <div className="rounded-xl p-6 bg-[#164734] text-white relative overflow-hidden">
                <p className="text-xs uppercase tracking-[.18em] text-lime-200 mb-3">
                  Herd composition
                </p>
                <h2 className="farm-heading text-2xl mb-6">Every animal accounted for.</h2>
                {q.data.byCategory.length ? (
                  <div className="space-y-4">
                    {q.data.byCategory.map((c) => (
                      <div key={c.category}>
                        <div className="flex justify-between text-sm mb-2">
                          <span>{label(c.category)}</span>
                          <span>{c._count}</span>
                        </div>
                        <div className="h-1.5 bg-white/15 rounded-full">
                          <div
                            className="h-full bg-lime-200 rounded-full"
                            style={{
                              width: `${q.data!.activeCattle ? (c._count / q.data!.activeCattle) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-green-100/80">
                    Your herd breakdown will appear when you add cattle.
                  </p>
                )}
              </div>
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="text-lg">Expected calvings</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Due soon or past the estimated date
                  </p>
                </CardHeader>
                <CardContent>
                  {q.data.expectedCalvings.length ? (
                    q.data.expectedCalvings.map((p) => (
                      <Link
                        href={`/breeding/${p.breedingCycleId}`}
                        key={p.id}
                        className="flex items-center justify-between gap-3 py-3 border-b last:border-0"
                      >
                        <div>
                          <p className="font-medium">{p.cycle?.cow.tagNumber}</p>
                          <p className="text-sm text-muted-foreground">
                            {displayDate(p.estimatedCalvingDate)}
                          </p>
                        </div>
                        <ArrowUpRight className="text-primary" size={18} />
                      </Link>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      No calvings expected in the next seven days.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </>
  );
}
