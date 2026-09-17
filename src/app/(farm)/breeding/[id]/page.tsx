'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Heart, GitBranch } from 'lucide-react';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionForm, f, occurred, dateField, notesField } from '@/components/farm/forms';
import { CalvingForm } from '@/components/farm/calving-form';
import { PageHeading, LoadState, Status, Detail, Empty } from '@/components/farm/common';
import { useCanManage } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { displayDate, label, taka } from '@/lib/utils';
import type { Cycle, Cow } from '@/lib/types';
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const q = useResource<Cycle>(`breeding/cycles/${id}`);
  const cow = useResource<Cow>(q.data ? `cows/${q.data.cowId}` : null);
  const manage = useCanManage();
  const c = q.data;
  const active = cow.data?.status === 'ACTIVE';
  const p = c?.pregnancy;
  return (
    <>
      <PageHeading
        title={cow.data ? `${cow.data.tagNumber} · Breeding cycle` : 'Breeding cycle'}
        back="/breeding"
        description={c ? `Started ${displayDate(c.startedOn)}` : undefined}
        action={c && <Status value={c.status} />}
      />
      <LoadState {...q} retry={q.refresh} />
      {c && (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {active && c.status === 'OPEN' && (
              <>
                <ActionForm
                  title="Record heat"
                  path={`breeding/cycles/${id}/heats`}
                  onSuccess={q.refresh}
                  fields={[
                    occurred('observedAt', 'Observed at'),
                    f('signs', 'Observed signs', 'textarea', true),
                    f('observedBy', 'Observed by'),
                    notesField,
                  ]}
                  trigger={<Button variant="outline">Record heat</Button>}
                />
                {manage && (
                  <ActionForm
                    title="Record service"
                    path={`breeding/cycles/${id}/services`}
                    onSuccess={q.refresh}
                    fields={[
                      occurred('performedAt', 'Performed at'),
                      f('method', 'Method', 'select', true, {
                        options: ['ARTIFICIAL_INSEMINATION', 'NATURAL_SERVICE'],
                      }),
                      f('semenCode', 'Semen code'),
                      f('semenBatch', 'Semen batch'),
                      f('bullDetails', 'Bull details'),
                      f('technicianName', 'Technician'),
                      f('cost', 'Cost (BDT)', 'number', false, { min: 0, step: '0.01', value: 0 }),
                      f('pregnancyCheckDueAt', 'Pregnancy check due', 'datetime-local'),
                      notesField,
                    ]}
                  />
                )}
              </>
            )}
            {manage && active && ['OPEN', 'PREGNANT'].includes(c.status) && (
              <ActionForm
                title="Record pregnancy check"
                path={`breeding/cycles/${id}/checks`}
                onSuccess={q.refresh}
                fields={[
                  occurred('checkedAt', 'Checked at'),
                  f('method', 'Check method', 'text', true),
                  f('result', 'Result', 'select', true, {
                    options:
                      c.status === 'PREGNANT'
                        ? ['PREGNANT', 'INCONCLUSIVE']
                        : ['PREGNANT', 'NOT_PREGNANT', 'INCONCLUSIVE'],
                  }),
                  f('veterinarianName', 'Veterinarian'),
                  f('cost', 'Cost (BDT)', 'number', false, { min: 0, step: '0.01', value: 0 }),
                  ...(!p
                    ? [
                        f('breedingServiceId', 'Attributed service (optional)', 'select', false, {
                          options: (c.services || []).map((s) => ({
                            value: s.id,
                            label: `${displayDate(s.performedAt, true)} · ${label(s.method)}`,
                          })),
                          help: 'Only select for a positive check. Leave blank if unknown.',
                        }),
                      ]
                    : []),
                  f('nextCheckDate', 'Next check date', 'date'),
                  notesField,
                ]}
                transform={(data) => {
                  if (data.result !== 'PREGNANT') delete data.breedingServiceId;
                  return data;
                }}
              />
            )}
          </div>
          <div className="grid xl:grid-cols-[1.35fr_1fr] gap-6">
            <div className="space-y-6">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GitBranch className="text-primary" size={20} />
                    Cycle history
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!c.heats?.length && !c.services?.length && !c.checks?.length ? (
                    <Empty
                      title="Ready for the first observation"
                      description="Record heat signs, a breeding service or a pregnancy check."
                    />
                  ) : (
                    <div className="space-y-6">
                      {[
                        ...(c.heats || []).map((h) => ({
                          id: h.id,
                          date: h.observedAt,
                          title: 'Heat observed',
                          description: h.signs,
                        })),
                        ...(c.services || []).map((s) => ({
                          id: s.id,
                          date: s.performedAt,
                          title: label(s.method),
                          description: `${s.technicianName || 'Technician not recorded'} · ${taka(s.cost)}`,
                        })),
                        ...(c.checks || []).map((ch) => ({
                          id: ch.id,
                          date: ch.checkedAt,
                          title: `Pregnancy check: ${label(ch.result)}`,
                          description: ch.method,
                        })),
                      ]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((e) => (
                          <div className="border-l-2 border-primary/25 pl-5" key={e.id}>
                            <p className="text-sm text-muted-foreground mb-1">
                              {displayDate(e.date, true)}
                            </p>
                            <h3 className="font-semibold">{e.title}</h3>
                            <p className="text-sm mt-1 whitespace-pre-line">{e.description}</p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
              {manage && active && c.status === 'OPEN' && (
                <ActionForm
                  title="Close unsuccessful cycle"
                  path={`breeding/cycles/${id}/close`}
                  onSuccess={q.refresh}
                  fields={[dateField('closedOn', 'Closed on'), notesField]}
                  trigger={<Button variant="outline">Close unsuccessful cycle</Button>}
                  description="Close this attempt and cancel its pending tasks. You can start a new cycle afterwards."
                />
              )}
            </div>
            <div className="space-y-6">
              <Card className="shadow-none">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Heart className="text-primary" size={20} />
                    Pregnancy
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {p ? (
                    <>
                      <Status value={p.status} />
                      <dl className="grid sm:grid-cols-2 xl:grid-cols-1 gap-4 my-6">
                        <Detail label="Confirmed" value={displayDate(p.confirmedOn)} />
                        <Detail
                          label="Estimated calving"
                          value={displayDate(p.estimatedCalvingDate)}
                        />
                        <Detail label="Planned dry-off" value={displayDate(p.plannedDryOffDate)} />
                        <Detail label="Actual dry-off" value={displayDate(p.actualDryOffDate)} />
                        {p.endedOn && (
                          <Detail label="Pregnancy ended" value={displayDate(p.endedOn)} />
                        )}
                      </dl>
                      {p.outcomeNotes && <p className="text-sm mb-5">{p.outcomeNotes}</p>}
                      {manage && active && p.status === 'ONGOING' && (
                        <div className="flex flex-wrap gap-2">
                          <ActionForm
                            title="Update pregnancy plan"
                            path={`breeding/pregnancies/${p.id}/plan`}
                            method="PATCH"
                            fields={[
                              f('estimatedCalvingDate', 'Estimated calving date', 'date', false, {
                                value: p.estimatedCalvingDate?.slice(0, 10) || '',
                              }),
                              ...(!p.actualDryOffDate
                                ? [
                                    f('plannedDryOffDate', 'Planned dry-off date', 'date', false, {
                                      value: p.plannedDryOffDate?.slice(0, 10) || '',
                                    }),
                                  ]
                                : []),
                            ]}
                            onSuccess={q.refresh}
                            trigger={<Button variant="outline">Plan dates</Button>}
                          />
                          {!p.actualDryOffDate && (
                            <ActionForm
                              title="Record dry-off"
                              path={`breeding/pregnancies/${p.id}/dry-off`}
                              fields={[dateField('actualDryOffDate', 'Actual dry-off date')]}
                              onSuccess={q.refresh}
                              trigger={<Button variant="outline">Record dry-off</Button>}
                            />
                          )}
                          <CalvingForm pregnancyId={p.id} onSuccess={q.refresh} />
                          <ActionForm
                            title="Record pregnancy loss"
                            path={`breeding/pregnancies/${p.id}/loss`}
                            fields={[
                              dateField('endedOn', 'Date of loss'),
                              f('outcomeNotes', 'Veterinarian findings / notes', 'textarea', true),
                            ]}
                            onSuccess={q.refresh}
                            danger
                            trigger={
                              <Button variant="ghost" className="text-destructive">
                                Record loss
                              </Button>
                            }
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="p-4 rounded-lg bg-secondary">
                      <h3 className="font-medium text-primary">Pregnancy not confirmed</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        An insemination is a service record. A positive pregnancy check is required
                        to confirm pregnancy.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
              {p?.calving && (
                <Card className="shadow-none">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle2 className="text-primary" size={20} />
                      Calving recorded
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{displayDate(p.calving.calvedAt, true)}</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {p.calving.bornAlive} live-born · {p.calving.stillborn} stillborn
                    </p>
                    <div className="mt-4 space-y-2">
                      {p.calving.calves.map((calf) => (
                        <Link
                          key={calf.id}
                          className="block text-primary underline"
                          href={`/cows/${calf.id}`}
                        >
                          {calf.tagNumber}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
