import { createRoutes } from '../lib/router';
import { z } from 'zod';
import { db, transaction, type Tx } from '../lib/db';
import { Prisma } from '../generated/prisma/client';
import {
  ok,
  text,
  notes,
  time,
  pastTime,
  uuid,
  paramId,
  pagination,
  paging,
  assert,
  ApiError,
} from '../lib/http';
import { cow } from '../lib/domain';
import { manage } from '../middleware/auth';
export const tasksRouter = createRoutes();
const types = z.enum([
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
]);
const taskInput = z
  .object({
    cowId: uuid,
    breedingCycleId: uuid.optional(),
    pregnancyId: uuid.optional(),
    healthEventId: uuid.optional(),
    treatmentId: uuid.optional(),
    assignedTo: uuid.optional(),
    taskType: types,
    title: text,
    dueAt: time,
  })
  .strict();
async function links(tx: Tx, input: z.infer<typeof taskInput>) {
  await cow(tx, input.cowId);
  if (input.assignedTo) {
    const u = await tx.farmUser.findUnique({ where: { id: input.assignedTo } });
    assert(u?.isActive, 'Assignee must be an active user', 400);
  }
  if (input.breedingCycleId) {
    const c = await tx.breedingCycle.findUnique({ where: { id: input.breedingCycleId } });
    assert(c?.cowId === input.cowId, 'Cycle belongs to another cow or does not exist', 400);
    assert(['OPEN', 'PREGNANT'].includes(c.status), 'Cycle is closed', 400);
  }
  if (input.pregnancyId) {
    const p = await tx.pregnancy.findUnique({
      where: { id: input.pregnancyId },
      include: { cycle: true },
    });
    assert(
      p?.cycle.cowId === input.cowId,
      'Pregnancy belongs to another cow or does not exist',
      400,
    );
    assert(p.status === 'ONGOING', 'Pregnancy ended', 400);
    if (input.breedingCycleId)
      assert(p.breedingCycleId === input.breedingCycleId, 'Pregnancy and cycle do not match', 400);
  }
  if (input.healthEventId) {
    const e = await tx.healthEvent.findUnique({ where: { id: input.healthEventId } });
    assert(e?.cowId === input.cowId, 'Health event belongs to another cow or does not exist', 400);
  }
  if (input.treatmentId) {
    const t = await tx.treatment.findUnique({
      where: { id: input.treatmentId },
      include: { healthEvent: true },
    });
    assert(
      t?.healthEvent.cowId === input.cowId,
      'Treatment belongs to another cow or does not exist',
      400,
    );
    assert(['ACTIVE', 'PLANNED'].includes(t.status), 'Treatment is closed', 400);
    if (input.healthEventId)
      assert(
        t.healthEventId === input.healthEventId,
        'Treatment and health event do not match',
        400,
      );
  }
}
tasksRouter.get('/', async (req, res) => {
  const q = pagination
    .extend({
      cowId: uuid.optional(),
      assignedTo: uuid.optional(),
      status: z.enum(['PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED']).optional(),
      from: time.optional(),
      to: time.optional(),
      overdue: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query);
  if (q.from && q.to) assert(q.to >= q.from, 'Invalid date range', 400);
  const where: Prisma.ScheduledTaskWhereInput = {
    cowId: q.cowId,
    assignedTo: q.assignedTo,
    status: q.overdue === 'true' ? 'PENDING' : q.status,
    dueAt: { gte: q.from, lte: q.to, ...(q.overdue === 'true' ? { lt: new Date() } : {}) },
  };
  const [items, total] = await db.$transaction([
    db.scheduledTask.findMany({
      where,
      ...paging(q),
      orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
      include: {
        cow: { select: { tagNumber: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    db.scheduledTask.count({ where }),
  ]);
  return ok(res, { items, total, page: q.page, limit: q.limit });
});
tasksRouter.post('/', manage, async (req, res) => {
  const input = taskInput.parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      await links(tx, input);
      return tx.scheduledTask.create({ data: input });
    }),
    'Task scheduled',
    201,
  );
});
tasksRouter.patch('/:id', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      dueAt: time.optional(),
      title: text.optional(),
      assignedTo: uuid.nullable().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const t = await tx.scheduledTask.findUnique({ where: { id } });
      if (!t) throw new ApiError(404, 'Task not found');
      await cow(tx, t.cowId);
      assert(t.status === 'PENDING', 'Task is already closed');
      if (input.assignedTo) {
        const u = await tx.farmUser.findUnique({ where: { id: input.assignedTo } });
        assert(u?.isActive, 'Assignee unavailable', 400);
      }
      return tx.scheduledTask.update({ where: { id }, data: input });
    }),
  );
});
// Typed evidence ensures a vaccination task cannot be completed by merely ticking a box.
tasksRouter.post('/:id/complete', async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      completedAt: pastTime,
      completionNotes: text,
      evidence: z
        .object({
          type: z.enum(['HEAT', 'SERVICE', 'CHECK', 'DRY_OFF', 'HEALTH_EVENT', 'ADMINISTRATION']),
          id: uuid,
        })
        .strict()
        .optional(),
    })
    .strict()
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const task = await tx.scheduledTask.findUnique({ where: { id } });
      if (!task) throw new ApiError(404, 'Task not found');
      await cow(tx, task.cowId);
      assert(task.status === 'PENDING', 'Task is already closed');
      if (req.user!.role === 'WORKER')
        assert(
          task.assignedTo === req.user!.id,
          'Workers can complete only tasks assigned to them',
          403,
        );
      const required: Record<string, string> = {
        HEAT_FOLLOWUP: 'HEAT',
        INSEMINATION: 'SERVICE',
        PREGNANCY_CHECK: 'CHECK',
        DRY_OFF: 'DRY_OFF',
        POSTPARTUM_CHECK: 'HEALTH_EVENT',
        VACCINATION: 'ADMINISTRATION',
        DEWORMING: 'ADMINISTRATION',
        TREATMENT: 'ADMINISTRATION',
        VET_FOLLOWUP: 'HEALTH_EVENT',
      };
      if (required[task.taskType])
        assert(
          input.evidence?.type === required[task.taskType],
          `Completion requires ${required[task.taskType]} evidence`,
          400,
        );
      if (input.evidence) {
        const e = input.evidence;
        let owner: string | undefined,
          at: Date | undefined,
          cycleId: string | undefined,
          pregnancyId: string | undefined,
          treatmentId: string | undefined,
          healthEventId: string | undefined;
        if (e.type === 'HEAT') {
          const r = await tx.heatObservation.findUnique({
            where: { id: e.id },
            include: { cycle: true },
          });
          owner = r?.cycle.cowId;
          at = r?.observedAt;
          cycleId = r?.breedingCycleId;
        }
        if (e.type === 'SERVICE') {
          const r = await tx.breedingService.findUnique({
            where: { id: e.id },
            include: { cycle: true },
          });
          owner = r?.cycle.cowId;
          at = r?.performedAt;
          cycleId = r?.breedingCycleId;
        }
        if (e.type === 'CHECK') {
          const r = await tx.pregnancyCheck.findUnique({
            where: { id: e.id },
            include: { cycle: { include: { pregnancy: true } } },
          });
          owner = r?.cycle.cowId;
          at = r?.checkedAt;
          cycleId = r?.breedingCycleId;
          pregnancyId = r?.cycle.pregnancy?.id;
        }
        if (e.type === 'DRY_OFF') {
          const r = await tx.pregnancy.findUnique({
            where: { id: e.id },
            include: { cycle: true },
          });
          owner = r?.cycle.cowId;
          at = r?.actualDryOffDate ?? undefined;
          pregnancyId = r?.id;
          cycleId = r?.breedingCycleId;
        }
        if (e.type === 'HEALTH_EVENT') {
          const r = await tx.healthEvent.findUnique({ where: { id: e.id } });
          owner = r?.cowId;
          at =
            r?.occurredAt; /* Follow-up is a new visit, so it need not equal the original health event. */
        }
        if (e.type === 'ADMINISTRATION') {
          const r = await tx.treatmentAdministration.findUnique({
            where: { id: e.id },
            include: { treatment: { include: { healthEvent: true } } },
          });
          owner = r?.treatment.healthEvent.cowId;
          at = r?.administeredAt;
          treatmentId = r?.treatmentId;
          healthEventId = r?.treatment.healthEventId;
          if (['VACCINATION', 'DEWORMING'].includes(task.taskType))
            assert(
              r?.treatment.treatmentType === task.taskType,
              'Administration type does not match task',
              400,
            );
        }
        assert(owner === task.cowId && at, 'Evidence must be an actual event for this cow', 400);
        assert(input.completedAt >= at, 'Completion cannot precede the event', 400);
        if (task.breedingCycleId && ['HEAT', 'SERVICE', 'CHECK', 'DRY_OFF'].includes(e.type))
          assert(cycleId === task.breedingCycleId, 'Evidence belongs to another cycle', 400);
        if (task.pregnancyId && ['CHECK', 'DRY_OFF'].includes(e.type))
          assert(pregnancyId === task.pregnancyId, 'Evidence belongs to another pregnancy', 400);
        if (task.treatmentId && e.type === 'ADMINISTRATION')
          assert(treatmentId === task.treatmentId, 'Evidence belongs to another treatment', 400);
        if (task.healthEventId && e.type === 'ADMINISTRATION')
          assert(
            healthEventId === task.healthEventId,
            'Evidence belongs to another health event',
            400,
          );
      }
      return tx.scheduledTask.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: input.completedAt,
          completionNotes: input.completionNotes,
          completionEvidence: input.evidence ?? Prisma.JsonNull,
        },
      });
    }),
    'Task completed',
  );
});
tasksRouter.post('/:id/cancel', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({ status: z.enum(['CANCELLED', 'SKIPPED']), completionNotes: text })
    .strict()
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const t = await tx.scheduledTask.findUnique({ where: { id } });
      if (!t) throw new ApiError(404, 'Task not found');
      assert(t.status === 'PENDING', 'Task is already closed');
      return tx.scheduledTask.update({ where: { id }, data: input });
    }),
  );
});
