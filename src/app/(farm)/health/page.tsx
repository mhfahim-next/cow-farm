'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight, HeartPulse } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { ActionForm, Choice, f, occurred, notesField } from '@/components/farm/forms';
import { PageHeading, LoadState, Empty, Pager } from '@/components/farm/common';
import { useResource } from '@/lib/api';
import { displayDate, label, taka } from '@/lib/utils';
import type { HealthEvent, List, Cow } from '@/lib/types';
function CowTag({ id }: { id: string }) {
  const c = useResource<Cow>(`cows/${id}`);
  return (
    <Link className="text-primary font-medium" href={`/cows/${id}`}>
      {c.data?.tagNumber || 'View cow'}
    </Link>
  );
}
function View() {
  const params = useSearchParams();
  const cowId = params.get('cowId');
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const q = useResource<List<HealthEvent>>(
    `health/events?page=${page}&limit=20${cowId ? `&cowId=${cowId}` : ''}${type === 'ALL' ? '' : `&eventType=${type}`}`,
  );
  const add = (
    <ActionForm
      title="Record health event"
      path="health/events"
      onSuccess={q.refresh}
      extra={cowId ? { cowId } : {}}
      fields={[
        ...(!cowId ? [f('cowId', 'Cow', 'cow', true)] : []),
        f('eventType', 'Event type', 'select', true, {
          options: ['ILLNESS', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'INJURY', 'OTHER'],
        }),
        occurred('occurredAt', 'Event date and time'),
        f('symptoms', 'Symptoms', 'textarea'),
        f('diagnosis', 'Diagnosis / findings', 'textarea'),
        f('veterinarianName', 'Veterinarian'),
        f('consultationCost', 'Consultation cost (BDT)', 'number', false, {
          min: 0,
          step: '0.01',
          value: 0,
        }),
        f('followUpDueAt', 'Follow-up due', 'datetime-local'),
        notesField,
      ]}
    />
  );
  return (
    <>
      <PageHeading
        title="Health records"
        description="Visits, vaccinations, deworming and treatment history."
        action={add}
      />
      <div className="flex justify-between gap-3 mb-6">
        <div className="w-56">
          <Choice
            value={type}
            onChange={(v) => {
              setType(v);
              setPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All health events' },
              ...['ILLNESS', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'INJURY', 'OTHER'].map((v) => ({
                value: v,
                label: label(v),
              })),
            ]}
          />
        </div>
        {cowId && (
          <Button asChild variant="link">
            <Link href="/health">Show all cattle</Link>
          </Button>
        )}
      </div>
      <LoadState {...q} retry={q.refresh} />
      {q.data &&
        (q.data.items.length ? (
          <>
            <div className="border rounded-xl bg-white overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Cow</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Consultation</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {q.data.items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        <div className="flex items-center gap-3 py-2">
                          <span className="size-9 rounded-lg bg-secondary text-primary grid place-items-center">
                            <HeartPulse size={18} />
                          </span>
                          <span className="font-medium">{label(e.eventType)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <CowTag id={e.cowId} />
                      </TableCell>
                      <TableCell>{displayDate(e.occurredAt)}</TableCell>
                      <TableCell>{taka(e.consultationCost)}</TableCell>
                      <TableCell>{e.resolvedAt ? 'Resolved' : 'Open'}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost">
                          <Link href={`/health/${e.id}`}>
                            Open
                            <ArrowUpRight size={16} />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Pager page={page} total={q.data.total} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="No health events recorded"
            description="Start with a veterinary visit, illness or planned health intervention."
            action={add}
          />
        ))}
    </>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading health records…</p>}>
      <View />
    </Suspense>
  );
}
