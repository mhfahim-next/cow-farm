'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ActionForm, f, dateField, notesField } from '@/components/farm/forms';
import { cowFields } from '@/components/farm/cow-fields';
import { PageHeading, LoadState, Empty, Status, Detail, Pager } from '@/components/farm/common';
import { useCanManage } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { displayDate, label, taka } from '@/lib/utils';
import type { Cow, List, TimelineEvent } from '@/lib/types';
function Timeline({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const q = useResource<List<TimelineEvent>>(`cows/${id}/timeline?page=${page}&limit=20`);
  return (
    <>
      <LoadState {...q} retry={q.refresh} />
      {q.data &&
        (q.data.items.length ? (
          <>
            <div className="space-y-5">
              {q.data.items.map((e, i) => (
                <div
                  key={`${e.type}-${e.id}-${i}`}
                  className="border-l-2 border-primary/25 pl-5 ml-2"
                >
                  <div className="flex gap-3 flex-wrap items-center">
                    <h3 className="font-semibold">{label(e.type)}</h3>
                    <span className="text-sm text-muted-foreground">
                      {displayDate(e.occurredAt, true)}
                    </span>
                  </div>
                  <dl className="grid sm:grid-cols-2 gap-2 mt-2 text-sm">
                    {Object.entries(e.details)
                      .filter(
                        ([k, v]) =>
                          !k.toLowerCase().endsWith('id') &&
                          !['createdAt', 'updatedAt'].includes(k) &&
                          v != null &&
                          typeof v !== 'object',
                      )
                      .map(([k, v]) => (
                        <div key={k} className="break-words">
                          <dt className="text-muted-foreground inline">
                            {label(k.replace(/([A-Z])/g, '_$1'))}:{' '}
                          </dt>
                          <dd className="inline">
                            {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                          </dd>
                        </div>
                      ))}
                  </dl>
                </div>
              ))}
            </div>
            <Pager page={page} total={q.data.total} onChange={setPage} />
          </>
        ) : (
          <Empty
            title="No events recorded"
            description="Breeding and health activities will appear here as they are recorded."
          />
        ))}
    </>
  );
}
export default function CowPage() {
  const { id } = useParams<{ id: string }>();
  const q = useResource<Cow>(`cows/${id}`);
  const manage = useCanManage();
  const c = q.data;
  return (
    <>
      <PageHeading
        title={c ? `${c.tagNumber}${c.name ? ' · ' + c.name : ''}` : 'Cow profile'}
        back="/cows"
        description={c ? `${label(c.category)} · ${c.breed || 'Breed not recorded'}` : undefined}
        action={c && <Status value={c.status} />}
      />
      <LoadState {...q} retry={q.refresh} />
      {c && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {manage && c.status === 'ACTIVE' && (
              <ActionForm
                title="Edit cow"
                path={`cows/${id}`}
                method="PATCH"
                onSuccess={q.refresh}
                fields={cowFields
                  .filter((f) => !['sex', 'origin'].includes(f.name))
                  .map((f) => ({
                    ...f,
                    value: (c as unknown as Record<string, string | boolean>)[f.name] ?? '',
                    ...(['birthDate', 'purchaseDate'].includes(f.name)
                      ? {
                          value:
                            (c as unknown as Record<string, string>)[f.name]?.slice(0, 10) || '',
                        }
                      : {}),
                  }))}
                trigger={<Button variant="outline">Edit details</Button>}
              />
            )}
            <Button variant="outline" asChild>
              <Link href={`/breeding?cowId=${id}`}>
                Breeding records
                <ArrowUpRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/health?cowId=${id}`}>
                Health records
                <ArrowUpRight />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/tasks?cowId=${id}`}>
                Tasks
                <ArrowUpRight />
              </Link>
            </Button>
          </div>
          {!!c.withdrawalRestrictions?.length && (
            <div className="border border-amber-200 bg-amber-50 p-5 rounded-xl mb-6">
              <h2 className="font-semibold flex items-center gap-2 text-amber-900">
                <AlertTriangle size={19} />
                Withdrawal restrictions
              </h2>
              {c.withdrawalRestrictions.map((t) => (
                <div key={t.id} className="text-sm mt-3">
                  <strong>{t.productName}</strong>
                  {t.milkWithdrawalRequired && (
                    <p>
                      Milk restriction:{' '}
                      {t.milkRestrictedUntil
                        ? displayDate(t.milkRestrictedUntil, true)
                        : 'End not recorded — confirm with your veterinarian'}
                    </p>
                  )}
                  {t.meatWithdrawalRequired && (
                    <p>
                      Meat restriction:{' '}
                      {t.meatRestrictedUntil
                        ? displayDate(t.meatRestrictedUntil, true)
                        : 'End not recorded — confirm with your veterinarian'}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <Tabs defaultValue="overview">
            <TabsList className="mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Full timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <div className="grid xl:grid-cols-[1.4fr_1fr] gap-6">
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle>Animal information</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid sm:grid-cols-2 gap-6">
                      <Detail label="Tag number" value={c.tagNumber} />
                      <Detail label="Sex" value={label(c.sex)} />
                      <Detail
                        label="Birth date"
                        value={`${displayDate(c.birthDate)}${c.birthDateEstimated ? ' (estimated)' : ''}`}
                      />
                      <Detail label="Origin" value={label(c.origin)} />
                      <Detail label="Purchase date" value={displayDate(c.purchaseDate)} />
                      <Detail label="Purchase price" value={taka(c.purchasePrice)} />
                      <Detail label="Seller" value={c.sellerName} />
                      <Detail
                        label="Mother"
                        value={
                          c.mother && (
                            <Link className="text-primary underline" href={`/cows/${c.mother.id}`}>
                              {c.mother.tagNumber}
                            </Link>
                          )
                        }
                      />
                    </dl>
                    {c.notes && (
                      <div className="mt-6 pt-5 border-t">
                        <h3 className="text-sm text-muted-foreground mb-2">Notes</h3>
                        <p className="whitespace-pre-line">{c.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="space-y-6">
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Current breeding cycle</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {c.cycles?.length ? (
                        c.cycles.map((cycle) => (
                          <div key={cycle.id}>
                            <Status value={cycle.status} />
                            <p className="text-sm text-muted-foreground mt-3">
                              Started {displayDate(cycle.startedOn)}
                            </p>
                            {cycle.pregnancy?.estimatedCalvingDate && (
                              <p className="mt-2">
                                Expected calving:{' '}
                                {displayDate(cycle.pregnancy.estimatedCalvingDate)}
                              </p>
                            )}
                            <Button variant="outline" asChild className="mt-4">
                              <Link href={`/breeding/${cycle.id}`}>
                                Open cycle
                                <ArrowUpRight />
                              </Link>
                            </Button>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground text-sm">No active breeding cycle.</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="shadow-none">
                    <CardHeader>
                      <CardTitle>Calves</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {c.calves?.length ? (
                        <div className="space-y-3">
                          {c.calves.map((calf) => (
                            <Link
                              className="flex justify-between text-primary"
                              key={calf.id}
                              href={`/cows/${calf.id}`}
                            >
                              {calf.tagNumber}
                              <ArrowUpRight size={17} />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No linked calf profiles.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
              {manage && c.status === 'ACTIVE' && (
                <div className="mt-8 border-t pt-6 flex flex-wrap justify-between gap-4 items-center">
                  <div>
                    <h3 className="font-medium">Cow no longer on the farm?</h3>
                    <p className="text-sm text-muted-foreground">
                      Record a sale, transfer or death. History is preserved and pending tasks are
                      cancelled.
                    </p>
                  </div>
                  <ActionForm
                    title="Archive cow"
                    path={`cows/${id}/exit`}
                    fields={[
                      f('status', 'Reason', 'select', true, {
                        options: ['SOLD', 'TRANSFERRED', 'DECEASED'],
                      }),
                      dateField('exitDate', 'Exit date'),
                      notesField,
                    ]}
                    onSuccess={q.refresh}
                    danger
                    buttonLabel="Confirm archive"
                    trigger={
                      <Button variant="outline" className="text-destructive">
                        Archive cow
                      </Button>
                    }
                  />
                </div>
              )}
            </TabsContent>
            <TabsContent value="timeline">
              <Card className="shadow-none">
                <CardContent className="p-6">
                  <Timeline id={id} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </>
  );
}
