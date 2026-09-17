'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Choice } from './forms';
import { Pager } from './common';
import { api, useResource } from '@/lib/api';
import { displayDate, label, localNow } from '@/lib/utils';
import type { Task, TimelineEvent, List } from '@/lib/types';
const evidenceTypes: Record<string, { type: string; timeline: string }> = {
  HEAT_FOLLOWUP: { type: 'HEAT', timeline: 'HEAT' },
  INSEMINATION: { type: 'SERVICE', timeline: 'BREEDING_SERVICE' },
  PREGNANCY_CHECK: { type: 'CHECK', timeline: 'PREGNANCY_CHECK' },
  DRY_OFF: { type: 'DRY_OFF', timeline: 'DRY_OFF' },
  POSTPARTUM_CHECK: { type: 'HEALTH_EVENT', timeline: 'HEALTH_EVENT' },
  VET_FOLLOWUP: { type: 'HEALTH_EVENT', timeline: 'HEALTH_EVENT' },
  VACCINATION: { type: 'ADMINISTRATION', timeline: 'TREATMENT_ADMINISTRATION' },
  DEWORMING: { type: 'ADMINISTRATION', timeline: 'TREATMENT_ADMINISTRATION' },
  TREATMENT: { type: 'ADMINISTRATION', timeline: 'TREATMENT_ADMINISTRATION' },
};
export function CompleteTask({ task, onSuccess }: { task: Task; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [evidenceId, setEvidenceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const expected = evidenceTypes[task.taskType];
  const events = useResource<List<TimelineEvent>>(
    open && expected ? `cows/${task.cowId}/timeline?page=${page}&limit=100` : null,
  );
  const eligible =
    events.data?.items.filter(
      (e) =>
        e.type === expected?.timeline &&
        (!task.treatmentId ||
          e.type !== 'TREATMENT_ADMINISTRATION' ||
          e.details.treatmentId === task.treatmentId) &&
        (!task.breedingCycleId ||
          !['HEAT', 'BREEDING_SERVICE', 'PREGNANCY_CHECK'].includes(e.type) ||
          e.details.breedingCycleId === task.breedingCycleId) &&
        (!task.pregnancyId || e.type !== 'DRY_OFF' || e.id === task.pregnancyId),
    ) || [];
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setOpen(v);
          setError('');
          setEvidenceId('');
          setPage(1);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Check size={15} />
          Complete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete task</DialogTitle>
          <DialogDescription>
            {task.title}. Record the actual activity first, then choose its record below.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (expected && !evidenceId) {
              setError('Select the actual event that completed this task.');
              return;
            }
            setBusy(true);
            setError('');
            const data = new FormData(e.currentTarget);
            try {
              await api(`tasks/${task.id}/complete`, {
                method: 'POST',
                body: JSON.stringify({
                  completedAt: new Date(`${data.get('completedAt')}:00+06:00`).toISOString(),
                  completionNotes: data.get('completionNotes'),
                  ...(expected ? { evidence: { type: expected.type, id: evidenceId } } : {}),
                }),
              });
              toast.success('Task completed');
              setOpen(false);
              onSuccess();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="completedAt">Completed at (Bangladesh)</Label>
            <Input
              name="completedAt"
              id="completedAt"
              type="datetime-local"
              defaultValue={localNow()}
              required
              disabled={busy}
            />
          </div>
          {expected && (
            <div className="space-y-2">
              <Label htmlFor="evidence">Actual {label(expected.type).toLowerCase()} record</Label>
              <Choice
                id="evidence"
                value={evidenceId}
                onChange={setEvidenceId}
                disabled={busy}
                options={eligible.map((e) => ({
                  value: e.id,
                  label: `${displayDate(e.occurredAt, true)} · ${String(e.details.result || e.details.productName || e.details.eventType || e.details.signs || e.details.doseAmount || label(e.type)).slice(0, 70)}`,
                }))}
                placeholder={events.loading ? 'Loading records…' : 'Choose an actual event'}
              />
              {events.error && (
                <p role="alert" className="text-destructive text-sm">
                  {events.error}
                </p>
              )}
              {!events.loading && !eligible.length && (
                <p className="text-sm text-muted-foreground">
                  No matching events on this history page. Record the activity first, or look on an
                  older page.
                </p>
              )}
              {events.data && events.data.total > 100 && (
                <Pager
                  page={page}
                  total={events.data.total}
                  limit={100}
                  onChange={(p) => {
                    setPage(p);
                    setEvidenceId('');
                  }}
                />
              )}
              <Button type="button" size="sm" variant="ghost" onClick={events.refresh}>
                Refresh event records
              </Button>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="completionNotes">Completion notes</Label>
            <Textarea id="completionNotes" name="completionNotes" required disabled={busy} />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy || (!!expected && !evidenceId)}>
            {busy && <Loader2 className="animate-spin" />}Complete task
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
