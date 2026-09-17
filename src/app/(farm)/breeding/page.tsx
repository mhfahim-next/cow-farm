'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { ActionForm, f, dateField, notesField } from '@/components/farm/forms';
import { PageHeading, LoadState, Empty, Pager, Status } from '@/components/farm/common';
import { useCanManage } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { displayDate } from '@/lib/utils';
import type { Cycle, Pregnancy, List, Cow } from '@/lib/types';
function View() {
  const params = useSearchParams();
  const cowId = params.get('cowId');
  const [tab, setTab] = useState(params.get('tab') || 'cycles');
  const [page, setPage] = useState(1);
  const manage = useCanManage();
  const cycles = useResource<List<Cycle>>(
    tab === 'cycles'
      ? `breeding/cycles?page=${page}&limit=20${cowId ? `&cowId=${cowId}` : ''}`
      : null,
  );
  const pregnancies = useResource<List<Pregnancy>>(
    tab === 'pregnancies'
      ? `breeding/pregnancies?page=${page}&limit=20${cowId ? `&cowId=${cowId}` : ''}`
      : null,
  );
  const cow = useResource<Cow>(cowId ? `cows/${cowId}` : null);
  const add = (
    <ActionForm
      title="Start breeding cycle"
      path="breeding/cycles"
      fields={[
        ...(!cowId ? [f('cowId', 'Cow', 'cow', true)] : []),
        dateField('startedOn', 'Cycle start date'),
        notesField,
      ]}
      extra={cowId ? { cowId } : {}}
      onSuccess={cycles.refresh}
    />
  );
  return (
    <>
      <PageHeading
        title="Breeding & pregnancy"
        description={
          cow.data
            ? `Reproductive history for ${cow.data.tagNumber}.`
            : 'Follow each cycle from heat observation to calving.'
        }
        action={manage && (!cow.data || cow.data.status === 'ACTIVE') && add}
      />
      {cowId && (
        <Button asChild variant="link" className="mb-4 px-0">
          <Link href="/breeding">Show all cattle</Link>
        </Button>
      )}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v);
          setPage(1);
        }}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="cycles">Breeding cycles</TabsTrigger>
          <TabsTrigger value="pregnancies">Pregnancies</TabsTrigger>
        </TabsList>
        <TabsContent value="cycles">
          <LoadState {...cycles} retry={cycles.refresh} />
          {cycles.data &&
            (cycles.data.items.length ? (
              <>
                <div className="bg-white border rounded-xl overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cycle started</TableHead>
                        <TableHead>Cow</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Expected calving</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cycles.data.items.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>{displayDate(c.startedOn)}</TableCell>
                          <TableCell>
                            <CowLink id={c.cowId} />
                          </TableCell>
                          <TableCell>
                            <Status value={c.status} />
                          </TableCell>
                          <TableCell>
                            {c.pregnancy?.estimatedCalvingDate
                              ? displayDate(c.pregnancy.estimatedCalvingDate)
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Button asChild variant="ghost">
                              <Link href={`/breeding/${c.id}`}>
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
                <Pager total={cycles.data.total} page={page} onChange={setPage} />
              </>
            ) : (
              <Empty
                title="No breeding cycles"
                description="Start a cycle for a female cow to record heat, services and pregnancy checks."
                action={manage && add}
              />
            ))}
        </TabsContent>
        <TabsContent value="pregnancies">
          <LoadState {...pregnancies} retry={pregnancies.refresh} />
          {pregnancies.data &&
            (pregnancies.data.items.length ? (
              <>
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {pregnancies.data.items.map((p) => (
                    <Link
                      className="rounded-xl bg-white border p-5 hover:border-primary/40"
                      key={p.id}
                      href={`/breeding/${p.breedingCycleId}`}
                    >
                      <div className="flex justify-between gap-2">
                        <h3 className="font-semibold">{p.cycle?.cow.tagNumber}</h3>
                        <Status value={p.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">Expected calving</p>
                      <p className="farm-heading text-2xl mt-1">
                        {displayDate(p.estimatedCalvingDate)}
                      </p>
                      <p className="text-sm text-muted-foreground mt-4">
                        Confirmed {displayDate(p.confirmedOn)}
                      </p>
                    </Link>
                  ))}
                </div>
                <Pager total={pregnancies.data.total} page={page} onChange={setPage} />
              </>
            ) : (
              <Empty
                title="No confirmed pregnancies"
                description="A positive pregnancy check creates a pregnancy record."
              />
            ))}
        </TabsContent>
      </Tabs>
    </>
  );
}
function CowLink({ id }: { id: string }) {
  const q = useResource<Cow>(`cows/${id}`);
  return (
    <Link className="font-medium text-primary hover:underline" href={`/cows/${id}`}>
      {q.data?.tagNumber || 'View cow'}
    </Link>
  );
}
export default function Page() {
  return (
    <Suspense fallback={<p>Loading breeding records…</p>}>
      <View />
    </Suspense>
  );
}
