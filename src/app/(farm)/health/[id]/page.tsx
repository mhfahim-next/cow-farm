'use client';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Pill, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { ActionForm, f, occurred, dateField, notesField } from '@/components/farm/forms';
import { PageHeading, LoadState, Empty, Status, Detail } from '@/components/farm/common';
import { useCanManage } from '@/components/farm/shell';
import { useResource } from '@/lib/api';
import { displayDate, label, taka } from '@/lib/utils';
import type { HealthEvent, Cow, Treatment } from '@/lib/types';
function TreatmentCard({
  t,
  active,
  onSuccess,
}: {
  t: Treatment;
  active: boolean;
  onSuccess: () => void;
}) {
  const manage = useCanManage();
  const canRecord = active && ['PLANNED', 'ACTIVE'].includes(t.status);
  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex justify-between gap-3">
          <div>
            <CardTitle className="flex gap-2 items-center">
              <Pill size={19} className="text-primary" />
              {t.productName}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {label(t.treatmentType)} · From {displayDate(t.startsOn)}
            </p>
          </div>
          <Status value={t.status} />
        </div>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line mb-5">{t.prescribedInstructions}</p>
        {(t.milkWithdrawalRequired || t.meatWithdrawalRequired) && (
          <div className="bg-amber-50 text-amber-900 border border-amber-100 rounded-lg p-4 text-sm mb-5">
            <p className="font-medium flex items-center gap-2 mb-2">
              <AlertTriangle size={16} />
              Recorded withdrawal requirements
            </p>
            {t.milkWithdrawalRequired && (
              <p>
                Milk:{' '}
                {t.milkRestrictedUntil
                  ? `restricted until ${displayDate(t.milkRestrictedUntil, true)}`
                  : 'End not recorded'}
              </p>
            )}
            {t.meatWithdrawalRequired && (
              <p>
                Meat:{' '}
                {t.meatRestrictedUntil
                  ? `restricted until ${displayDate(t.meatRestrictedUntil, true)}`
                  : 'End not recorded'}
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mb-5">
          {canRecord && (
            <ActionForm
              title="Record administration"
              path={`health/treatments/${t.id}/administrations`}
              onSuccess={onSuccess}
              fields={[
                occurred('administeredAt', 'Administered at'),
                f('doseAmount', 'Actual dose amount', 'number', true, {
                  min: 0.001,
                  step: '0.001',
                }),
                f('doseUnit', 'Dose unit', 'text', true, {
                  help: 'Use the unit on the prescription, for example mL.',
                }),
                f('route', 'Administration route'),
                f('productBatch', 'Product batch'),
                f('productExpiry', 'Product expiry', 'date'),
                f('administeredBy', 'Administered by'),
                f('cost', 'Cost (BDT)', 'number', false, { min: 0, step: '0.01', value: 0 }),
                ...(t.milkWithdrawalRequired
                  ? [f('milkRestrictedUntil', 'Milk restriction ends', 'datetime-local', true)]
                  : []),
                ...(t.meatWithdrawalRequired
                  ? [f('meatRestrictedUntil', 'Meat restriction ends', 'datetime-local', true)]
                  : []),
                notesField,
              ]}
              description="Record the actual administration and prescribed withdrawal end times. No doses are calculated by this app."
              trigger={<Button variant="outline">Record administration</Button>}
            />
          )}{' '}
          {manage && canRecord && (
            <ActionForm
              title="Close treatment"
              path={`health/treatments/${t.id}/close`}
              onSuccess={onSuccess}
              fields={[
                f('status', 'Outcome', 'select', true, { options: ['COMPLETED', 'STOPPED'] }),
                dateField('endsOn', 'Treatment end date'),
                notesField,
              ]}
              trigger={<Button variant="ghost">Close treatment</Button>}
              description="This cancels pending tasks linked to the treatment. Complete the relevant tasks first. Withdrawal restrictions remain recorded."
            />
          )}
        </div>
        <h3 className="text-sm font-semibold mb-3">Administration history</h3>
        {t.administrations?.length ? (
          <div className="divide-y">
            {t.administrations.map((a) => (
              <div key={a.id} className="py-3 flex justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {a.doseAmount} {a.doseUnit}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {displayDate(a.administeredAt, true)}
                  </p>
                  {a.productBatch && (
                    <p className="text-xs text-muted-foreground">Batch {a.productBatch}</p>
                  )}
                </div>
                <p className="text-sm">{taka(a.cost)}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No doses recorded yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const q = useResource<HealthEvent>(`health/events/${id}`);
  const cow = useResource<Cow>(q.data ? `cows/${q.data.cowId}` : null);
  const manage = useCanManage();
  const e = q.data;
  const active = cow.data?.status === 'ACTIVE';
  return (
    <>
      <PageHeading
        title={e ? `${label(e.eventType)} · ${cow.data?.tagNumber || 'Cow'}` : 'Health event'}
        back="/health"
        description={e ? displayDate(e.occurredAt, true) : undefined}
        action={e && <Status value={e.resolvedAt ? 'COMPLETED' : 'OPEN'} />}
      />
      <LoadState {...q} retry={q.refresh} />
      {e && (
        <div className="grid xl:grid-cols-[.85fr_1.4fr] gap-6">
          <Card className="shadow-none self-start">
            <CardHeader>
              <CardTitle>Visit details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-5">
                <Detail
                  label="Cow"
                  value={
                    <Link className="text-primary underline" href={`/cows/${e.cowId}`}>
                      {cow.data?.tagNumber || 'View cow'}
                    </Link>
                  }
                />
                <Detail label="Symptoms" value={e.symptoms} />
                <Detail label="Diagnosis / findings" value={e.diagnosis} />
                <Detail label="Veterinarian" value={e.veterinarianName} />
                <Detail label="Consultation cost" value={taka(e.consultationCost)} />
                <Detail label="Notes" value={e.notes} />
                {e.resolvedAt && (
                  <Detail label="Resolved" value={displayDate(e.resolvedAt, true)} />
                )}
              </dl>
              {manage && active && !e.resolvedAt && (
                <div className="mt-6">
                  <ActionForm
                    title="Resolve health event"
                    path={`health/events/${id}/resolve`}
                    fields={[occurred('resolvedAt', 'Resolved at')]}
                    onSuccess={q.refresh}
                    trigger={<Button variant="outline">Mark resolved</Button>}
                  />
                </div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <h2 className="text-xl font-semibold">Treatments</h2>
              {manage && active && !e.resolvedAt && (
                <ActionForm
                  title="Add treatment plan"
                  path={`health/events/${id}/treatments`}
                  onSuccess={q.refresh}
                  fields={[
                    f('treatmentType', 'Treatment type', 'select', true, {
                      options: ['MEDICATION', 'VACCINATION', 'DEWORMING', 'OTHER'],
                    }),
                    f('productName', 'Product name', 'text', true),
                    f('targetDisease', 'Target disease'),
                    f('prescribedInstructions', 'Prescribed instructions', 'textarea', true),
                    f('prescribedBy', 'Prescribed by'),
                    dateField('startsOn', 'Start date'),
                    f('endsOn', 'End date', 'date'),
                    f('milkWithdrawalRequired', 'Milk withdrawal required', 'checkbox'),
                    f('meatWithdrawalRequired', 'Meat withdrawal required', 'checkbox'),
                    f('nextDueAt', 'Next administration due', 'datetime-local'),
                    notesField,
                  ]}
                  description="Enter the veterinarian’s plan. Record actual doses separately. Required withdrawal end times are entered for each administration."
                />
              )}
            </div>
            {e.treatments?.length ? (
              e.treatments.map((t) => (
                <TreatmentCard key={t.id} t={t} active={active} onSuccess={q.refresh} />
              ))
            ) : (
              <Empty
                title="No treatment plans"
                description="Add a prescribed plan to record vaccinations, deworming or a medication course."
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
