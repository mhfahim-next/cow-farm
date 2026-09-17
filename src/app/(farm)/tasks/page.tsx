'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionForm, Choice, f } from '@/components/farm/forms';
import { CompleteTask } from '@/components/farm/task-complete';
import { PageHeading, LoadState, Empty, Pager, Status } from '@/components/farm/common';
import { useCanManage, useUser } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { displayDate, label, localNow } from '@/lib/utils';
import type { Task, List, User } from '@/lib/types';
const types = [
  'HEAT_FOLLOWUP',
  'INSEMINATION',
  'PREGNANCY_CHECK',
  'DRY_OFF',
  'CALVING_PREPARATION',
  'POSTPARTUM_CHECK',
  'VACCINATION',
  'DEWORMING',
  'TREATMENT',
  'VET_FOLLOWUP',
  'OTHER',
];
function View() {
  const params = useSearchParams();
  const cowId = params.get('cowId');
  const [filter, setFilter] = useState(params.get('overdue') === 'true' ? 'OVERDUE' : 'PENDING');
  const [page, setPage] = useState(1);
  const manage = useCanManage();
  const user = useUser();
  const [mine, setMine] = useState(user.role === 'WORKER' ? 'MINE' : 'ALL');
  const q = useResource<List<Task>>(
    `tasks?page=${page}&limit=20${cowId ? `&cowId=${cowId}` : ''}${filter === 'OVERDUE' ? '&overdue=true' : filter === 'ALL' ? '' : `&status=${filter}`}${mine === 'MINE' ? `&assignedTo=${user.id}` : ''}`,
  );
  const staff = useResource<User[]>(user.role === 'OWNER' ? 'users' : null);
  const assignees = [
    { value: user.id, label: `${user.name} (me)` },
    ...(staff.data || [])
      .filter((u) => u.id !== user.id)
      .map((u) => ({ value: u.id, label: u.name })),
  ];
  const add = (
    <ActionForm
      title="Schedule task"
      path="tasks"
      onSuccess={q.refresh}
      extra={cowId ? { cowId } : {}}
      fields={[
        ...(!cowId ? [f('cowId', 'Cow', 'cow', true)] : []),
        f('taskType', 'Task type', 'select', true, { options: types }),
        f('title', 'Task title', 'text', true),
        f('dueAt', 'Due date and time', 'datetime-local', true, { value: localNow() }),
        f('assignedTo', 'Assigned to (optional)', 'select', false, {
          options: assignees,
          help:
            user.role === 'OWNER'
              ? 'Choose an active staff member.'
              : 'Managers can assign to themselves; the owner can assign other staff.',
        }),
      ]}
    />
  );
  return (
    <>
      <PageHeading
        title="Tasks & schedule"
        description="Know what is due, record what is done, and keep follow-ups on track."
        action={manage && add}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="w-44">
          <Choice
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setPage(1);
            }}
            options={['PENDING', 'OVERDUE', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'ALL']}
          />
        </div>
        <div className="w-44">
          <Choice
            value={mine}
            onChange={(v) => {
              setMine(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All assignments' },
              { value: 'MINE', label: 'Assigned to me' },
            ]}
          />
        </div>
        {cowId && (
          <Button asChild variant="link">
            <Link href="/tasks">Show all cattle</Link>
          </Button>
        )}
      </div>
      <LoadState {...q} retry={q.refresh} />
      {q.data &&
        (q.data.items.length ? (
          <>
            <div className="space-y-3">
              {q.data.items.map((t) => {
                const overdue = t.status === 'PENDING' && new Date(t.dueAt) < new Date();
                return (
                  <article key={t.id} className="bg-white rounded-xl border p-5">
                    <div className="flex gap-4">
                      <span
                        className={`hidden sm:grid size-11 shrink-0 place-items-center rounded-lg ${overdue ? 'bg-amber-50 text-amber-700' : 'bg-secondary text-primary'}`}
                      >
                        <CalendarClock size={21} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap justify-between gap-2">
                          <h2 className="font-semibold break-words">{t.title}</h2>
                          <Status value={overdue ? 'OVERDUE' : t.status} />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
                          <Link href={`/cows/${t.cowId}`} className="text-primary">
                            {t.cow?.tagNumber || 'Cow profile'}
                          </Link>
                          <span>{label(t.taskType)}</span>
                          <span>{displayDate(t.dueAt, true)}</span>
                          <span>{t.assignee?.name || 'Unassigned'}</span>
                        </div>
                        {t.completionNotes && <p className="text-sm mt-3">{t.completionNotes}</p>}
                        {t.status === 'PENDING' && (
                          <div className="flex flex-wrap gap-2 mt-4">
                            {(manage || t.assignedTo === user.id) && (
                              <CompleteTask task={t} onSuccess={q.refresh} />
                            )}
                            <Button variant="ghost" size="sm" asChild>
                              <Link
                                href={
                                  [
                                    'VACCINATION',
                                    'DEWORMING',
                                    'TREATMENT',
                                    'VET_FOLLOWUP',
                                    'POSTPARTUM_CHECK',
                                  ].includes(t.taskType)
                                    ? `/health?cowId=${t.cowId}`
                                    : `/breeding?cowId=${t.cowId}`
                                }
                              >
                                Open records
                              </Link>
                            </Button>
                            {manage && (
                              <>
                                <ActionForm
                                  title="Reschedule task"
                                  path={`tasks/${t.id}`}
                                  method="PATCH"
                                  fields={[
                                    f('dueAt', 'New due date and time', 'datetime-local', true),
                                    f('assignedTo', 'Assigned to (optional)', 'select', false, {
                                      options: assignees,
                                      value:
                                        t.assignedTo &&
                                        assignees.some((a) => a.value === t.assignedTo)
                                          ? t.assignedTo
                                          : '',
                                    }),
                                  ]}
                                  onSuccess={q.refresh}
                                  trigger={
                                    <Button variant="ghost" size="sm">
                                      Reschedule / assign
                                    </Button>
                                  }
                                />
                                <ActionForm
                                  title="Cancel or skip task"
                                  path={`tasks/${t.id}/cancel`}
                                  fields={[
                                    f('status', 'Action', 'select', true, {
                                      options: ['CANCELLED', 'SKIPPED'],
                                    }),
                                    f('completionNotes', 'Reason', 'textarea', true),
                                  ]}
                                  onSuccess={q.refresh}
                                  danger
                                  trigger={
                                    <Button variant="ghost" size="sm" className="text-destructive">
                                      Cancel / skip
                                    </Button>
                                  }
                                />
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <Pager total={q.data.total} page={page} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="No matching tasks"
            description="Tasks appear here when you schedule work or add follow-up dates to farm records."
            action={manage && add}
          />
        ))}
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading tasks…</p>}>
      <View />
    </Suspense>
  );
}
