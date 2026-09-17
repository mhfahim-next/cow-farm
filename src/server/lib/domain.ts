import type { Tx } from './db';
import { assert, ApiError, day } from './http';
export async function cow(tx: Tx, id: string, active = true) {
  const c = await tx.cow.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'Cow not found');
  if (active) assert(c.status === 'ACTIVE', 'Cow is no longer active');
  return c;
}
export async function cycle(tx: Tx, id: string, statuses = ['OPEN']) {
  const c = await tx.breedingCycle.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, 'Breeding cycle not found');
  await cow(tx, c.cowId);
  assert(statuses.includes(c.status), 'Breeding cycle is not in the required state');
  return c;
}
export async function pregnancy(tx: Tx, id: string) {
  const p = await tx.pregnancy.findUnique({ where: { id }, include: { cycle: true } });
  if (!p) throw new ApiError(404, 'Pregnancy not found');
  await cow(tx, p.cycle.cowId);
  assert(p.status === 'ONGOING', 'Pregnancy has already ended');
  return p;
}
export function after(value: Date, start: Date, label = 'Event') {
  assert(day(value) >= day(start), `${label} must not precede the start date`, 400);
}
export async function cancelPregnancyTasks(tx: Tx, id: string) {
  await tx.scheduledTask.updateMany({
    where: { pregnancyId: id, status: 'PENDING' },
    data: { status: 'CANCELLED', completionNotes: 'Pregnancy ended' },
  });
}
