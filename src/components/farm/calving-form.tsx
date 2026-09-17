'use client';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { api, ApiError } from '@/lib/api';
import { localNow } from '@/lib/utils';
export function CalvingForm({
  pregnancyId,
  onSuccess,
}: {
  pregnancyId: string;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [alive, setAlive] = useState(1);
  const [stillborn, setStillborn] = useState(0);
  const [sexes, setSexes] = useState<Record<number, string>>({ 0: 'FEMALE' });
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!busy) {
          setOpen(v);
          setError('');
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>Record calving</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record calving</DialogTitle>
          <DialogDescription>
            This closes the pregnancy and creates a profile for each live-born calf.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const data = new FormData(e.currentTarget);
            try {
              await api(`breeding/pregnancies/${pregnancyId}/calving`, {
                method: 'POST',
                body: JSON.stringify({
                  calvedAt: new Date(`${data.get('calvedAt')}:00+06:00`).toISOString(),
                  totalBorn: alive + stillborn,
                  bornAlive: alive,
                  stillborn,
                  assistanceLevel: data.get('assistanceLevel') || undefined,
                  notes: data.get('notes') || undefined,
                  calves: Array.from({ length: alive }, (_, i) => ({
                    tagNumber: data.get(`tag-${i}`),
                    name: data.get(`name-${i}`) || undefined,
                    sex: sexes[i] || 'FEMALE',
                  })),
                  ...(data.get('postpartum')
                    ? {
                        postpartumCheckDueAt: new Date(
                          `${data.get('postpartum')}:00+06:00`,
                        ).toISOString(),
                      }
                    : {}),
                }),
              });
              toast.success('Calving and calf profiles saved');
              setOpen(false);
              onSuccess();
            } catch (e) {
              setError(
                e instanceof ApiError && e.fields.length
                  ? e.fields.map((x) => x.message).join('; ')
                  : (e as Error).message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="calvedAt">Calving date and time (Bangladesh)</Label>
              <Input
                id="calvedAt"
                name="calvedAt"
                type="datetime-local"
                required
                defaultValue={localNow()}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="alive">Live-born calves</Label>
                <Input
                  id="alive"
                  type="number"
                  min="0"
                  max="10"
                  value={alive}
                  onChange={(e) => setAlive(Math.max(0, Math.min(10, Number(e.target.value))))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stillborn">Stillborn calves</Label>
                <Input
                  id="stillborn"
                  type="number"
                  min="0"
                  max="10"
                  value={stillborn}
                  onChange={(e) => setStillborn(Math.max(0, Math.min(10, Number(e.target.value))))}
                />
              </div>
            </div>
            {Array.from({ length: alive }, (_, i) => (
              <div key={i} className="p-4 border rounded-lg space-y-3">
                <h3 className="font-medium">Calf {i + 1}</h3>
                <Label htmlFor={`tag-${i}`}>Unique tag number</Label>
                <Input id={`tag-${i}`} name={`tag-${i}`} required maxLength={50} />
                <Label htmlFor={`sex-${i}`}>Sex</Label>
                <Choice
                  id={`sex-${i}`}
                  value={sexes[i] || 'FEMALE'}
                  onChange={(v) => setSexes((s) => ({ ...s, [i]: v }))}
                  options={['FEMALE', 'MALE']}
                />
                <Label htmlFor={`name-${i}`}>Name (optional)</Label>
                <Input id={`name-${i}`} name={`name-${i}`} />
              </div>
            ))}
            <Label htmlFor="assistanceLevel">Assistance / notes</Label>
            <Input
              id="assistanceLevel"
              name="assistanceLevel"
              placeholder="For example: unassisted"
            />
            <Label htmlFor="postpartum">Postpartum check due (optional)</Label>
            <Input id="postpartum" name="postpartum" type="datetime-local" />
          </fieldset>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || alive + stillborn < 1 || alive + stillborn > 10}
            className="w-full"
          >
            {busy && <Loader2 className="animate-spin" />}Save calving
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
