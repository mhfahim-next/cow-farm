import { createRoutes } from '../lib/router';
import { z } from 'zod';
import { db, transaction } from '../lib/db';
import {
  ok,
  text,
  notes,
  pastDate,
  pastTime,
  date,
  time,
  money,
  uuid,
  paramId,
  pagination,
  paging,
  assert,
  day,
  ApiError,
} from '../lib/http';
import { cow, cycle, pregnancy, after, cancelPregnancyTasks } from '../lib/domain';
import { manage } from '../middleware/auth';
export const breedingRouter = createRoutes();
breedingRouter.get('/cycles', async (req, res) => {
  const q = pagination
    .extend({
      cowId: uuid.optional(),
      status: z
        .enum(['OPEN', 'PREGNANT', 'CLOSED_UNSUCCESSFUL', 'CLOSED_CALVED', 'CLOSED_LOSS'])
        .optional(),
    })
    .parse(req.query);
  const where = { cowId: q.cowId, status: q.status };
  const [items, total] = await db.$transaction([
    db.breedingCycle.findMany({
      where,
      ...paging(q),
      orderBy: [{ startedOn: 'desc' }, { id: 'desc' }],
      include: { pregnancy: true },
    }),
    db.breedingCycle.count({ where }),
  ]);
  return ok(res, { items, total, page: q.page, limit: q.limit });
});
breedingRouter.get('/cycles/:id', async (req, res) => {
  const data = await db.breedingCycle.findUnique({
    where: { id: paramId(req) },
    include: {
      heats: { orderBy: { observedAt: 'asc' } },
      services: { orderBy: { performedAt: 'asc' } },
      checks: { orderBy: { checkedAt: 'asc' } },
      pregnancy: { include: { calving: { include: { calves: true } } } },
    },
  });
  if (!data) throw new ApiError(404, 'Cycle not found');
  return ok(res, data);
});
breedingRouter.post('/cycles', manage, async (req, res) => {
  const input = z.object({ cowId: uuid, startedOn: pastDate, notes }).strict().parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cow(tx, input.cowId);
      assert(c.sex === 'FEMALE', 'Breeding requires a female cow', 400);
      if (c.birthDate) after(input.startedOn, c.birthDate, 'Cycle');
      return tx.breedingCycle.create({ data: input });
    }),
    'Breeding cycle created',
    201,
  );
});
breedingRouter.post('/cycles/:id/heats', async (req, res) => {
  const id = paramId(req);
  const data = z
    .object({ observedAt: pastTime, signs: text, observedBy: text.optional(), notes })
    .strict()
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cycle(tx, id);
      after(data.observedAt, c.startedOn);
      return tx.heatObservation.create({ data: { ...data, breedingCycleId: id } });
    }),
    'Heat recorded',
    201,
  );
});
breedingRouter.post('/cycles/:id/services', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      performedAt: pastTime,
      method: z.enum(['ARTIFICIAL_INSEMINATION', 'NATURAL_SERVICE']),
      semenCode: text.optional(),
      semenBatch: text.optional(),
      bullDetails: text.optional(),
      technicianName: text.optional(),
      cost: money.default(0),
      notes,
      pregnancyCheckDueAt: time.optional(),
    })
    .strict()
    .parse(req.body);
  const { pregnancyCheckDueAt, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cycle(tx, id);
      after(data.performedAt, c.startedOn);
      const service = await tx.breedingService.create({ data: { ...data, breedingCycleId: id } });
      if (pregnancyCheckDueAt) {
        assert(pregnancyCheckDueAt > data.performedAt, 'Check due date must follow service', 400);
        await tx.scheduledTask.create({
          data: {
            cowId: c.cowId,
            breedingCycleId: id,
            taskType: 'PREGNANCY_CHECK',
            title: 'Pregnancy check',
            dueAt: pregnancyCheckDueAt,
          },
        });
      }
      return service;
    }),
    'Service recorded; pregnancy remains unconfirmed',
    201,
  );
});
breedingRouter.post('/cycles/:id/checks', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      checkedAt: pastTime,
      method: text,
      result: z.enum(['PREGNANT', 'NOT_PREGNANT', 'INCONCLUSIVE']),
      veterinarianName: text.optional(),
      nextCheckDate: date.optional(),
      cost: money.default(0),
      notes,
      breedingServiceId: uuid.optional(),
      estimatedCalvingDate: date.optional(),
      plannedDryOffDate: date.optional(),
    })
    .strict()
    .parse(req.body);
  const { breedingServiceId, estimatedCalvingDate, plannedDryOffDate, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cycle(tx, id, ['OPEN', 'PREGNANT']);
      after(data.checkedAt, c.startedOn);
      const last = await tx.pregnancyCheck.findFirst({
        where: { breedingCycleId: id },
        orderBy: { checkedAt: 'desc' },
      });
      if (last)
        assert(
          data.checkedAt >= last.checkedAt,
          'Checks must be recorded in chronological order',
          400,
        );
      if (c.status === 'PREGNANT')
        assert(
          data.result !== 'NOT_PREGNANT',
          'Use pregnancy loss endpoint to end a confirmed pregnancy',
        );
      if (data.result !== 'PREGNANT')
        assert(
          !breedingServiceId && !estimatedCalvingDate && !plannedDryOffDate,
          'Pregnancy details require a positive result',
          400,
        );
      if (breedingServiceId) {
        const service = await tx.breedingService.findUnique({ where: { id: breedingServiceId } });
        assert(service?.breedingCycleId === id, 'Service must belong to this cycle', 400);
        assert(service.performedAt <= data.checkedAt, 'Check cannot precede service', 400);
      }
      if (estimatedCalvingDate) after(estimatedCalvingDate, data.checkedAt, 'Expected calving');
      if (plannedDryOffDate) {
        after(plannedDryOffDate, data.checkedAt, 'Planned dry-off');
        if (estimatedCalvingDate)
          assert(
            plannedDryOffDate <= estimatedCalvingDate,
            'Dry-off cannot follow expected calving',
            400,
          );
      }
      const check = await tx.pregnancyCheck.create({ data: { ...data, breedingCycleId: id } });
      let confirmed = await tx.pregnancy.findUnique({ where: { breedingCycleId: id } });
      if (data.result === 'PREGNANT' && !confirmed) {
        confirmed = await tx.pregnancy.create({
          data: {
            breedingCycleId: id,
            breedingServiceId,
            confirmedOn: day(data.checkedAt),
            estimatedCalvingDate,
            plannedDryOffDate,
          },
        });
        await tx.breedingCycle.update({ where: { id }, data: { status: 'PREGNANT' } });
        if (estimatedCalvingDate)
          await tx.scheduledTask.create({
            data: {
              cowId: c.cowId,
              pregnancyId: confirmed.id,
              taskType: 'CALVING_PREPARATION',
              title: 'Estimated calving: review preparation',
              dueAt: estimatedCalvingDate,
            },
          });
        if (plannedDryOffDate)
          await tx.scheduledTask.create({
            data: {
              cowId: c.cowId,
              pregnancyId: confirmed.id,
              taskType: 'DRY_OFF',
              title: 'Planned dry-off',
              dueAt: plannedDryOffDate,
            },
          });
      } else if (confirmed)
        assert(
          !breedingServiceId && !estimatedCalvingDate && !plannedDryOffDate,
          'Use pregnancy planning endpoint to update existing dates',
          400,
        );
      if (data.nextCheckDate) {
        after(data.nextCheckDate, data.checkedAt, 'Next check');
        await tx.scheduledTask.create({
          data: {
            cowId: c.cowId,
            breedingCycleId: id,
            taskType: 'PREGNANCY_CHECK',
            title: 'Pregnancy follow-up',
            dueAt: data.nextCheckDate,
          },
        });
      }
      return { check, pregnancy: confirmed };
    }),
    'Pregnancy check recorded',
    201,
  );
});
breedingRouter.post('/cycles/:id/close', manage, async (req, res) => {
  const id = paramId(req);
  const input = z.object({ closedOn: pastDate, notes }).strict().parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cycle(tx, id);
      after(input.closedOn, c.startedOn, 'Closure');
      const latest = await tx.breedingService.findFirst({
        where: { breedingCycleId: id },
        orderBy: { performedAt: 'desc' },
      });
      if (latest) after(input.closedOn, latest.performedAt, 'Closure');
      await tx.scheduledTask.updateMany({
        where: { breedingCycleId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return tx.breedingCycle.update({
        where: { id },
        data: { ...input, status: 'CLOSED_UNSUCCESSFUL' },
      });
    }),
  );
});
breedingRouter.get('/pregnancies', async (req, res) => {
  const q = pagination
    .extend({ status: z.enum(['ONGOING', 'CALVED', 'LOST']).optional(), cowId: uuid.optional() })
    .parse(req.query);
  const where = { status: q.status, cycle: { cowId: q.cowId } };
  const [items, total] = await db.$transaction([
    db.pregnancy.findMany({
      where,
      ...paging(q),
      include: {
        cycle: { include: { cow: { select: { id: true, tagNumber: true, status: true } } } },
      },
      orderBy: [{ confirmedOn: 'desc' }, { id: 'desc' }],
    }),
    db.pregnancy.count({ where }),
  ]);
  return ok(res, { items, total, page: q.page, limit: q.limit });
});
breedingRouter.patch('/pregnancies/:id/plan', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({ estimatedCalvingDate: date.optional(), plannedDryOffDate: date.optional() })
    .strict()
    .refine((v) => Object.keys(v).length > 0)
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const p = await pregnancy(tx, id);
      const expected = input.estimatedCalvingDate ?? p.estimatedCalvingDate;
      const dry = input.plannedDryOffDate ?? p.plannedDryOffDate;
      if (expected) after(expected, p.confirmedOn, 'Expected calving');
      if (dry) {
        after(dry, p.confirmedOn, 'Planned dry-off');
        if (expected) assert(dry <= expected, 'Dry-off cannot follow expected calving', 400);
      }
      if (input.plannedDryOffDate) assert(!p.actualDryOffDate, 'Dry-off already recorded');
      for (const [key, type, title] of [
        ['estimatedCalvingDate', 'CALVING_PREPARATION', 'Estimated calving: review preparation'],
        ['plannedDryOffDate', 'DRY_OFF', 'Planned dry-off'],
      ] as const) {
        const dueAt = input[key];
        if (dueAt) {
          await tx.scheduledTask.updateMany({
            where: { pregnancyId: id, taskType: type, status: 'PENDING' },
            data: { status: 'CANCELLED', completionNotes: 'Plan superseded' },
          });
          await tx.scheduledTask.create({
            data: { cowId: p.cycle.cowId, pregnancyId: id, taskType: type, title, dueAt },
          });
        }
      }
      return tx.pregnancy.update({ where: { id }, data: input });
    }),
  );
});
breedingRouter.post('/pregnancies/:id/dry-off', manage, async (req, res) => {
  const id = paramId(req);
  const input = z.object({ actualDryOffDate: pastDate }).strict().parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const p = await pregnancy(tx, id);
      assert(!p.actualDryOffDate, 'Dry-off already recorded');
      after(input.actualDryOffDate, p.confirmedOn, 'Dry-off');
      return tx.pregnancy.update({ where: { id }, data: input });
    }),
  );
});
breedingRouter.post('/pregnancies/:id/loss', manage, async (req, res) => {
  const id = paramId(req);
  const input = z.object({ endedOn: pastDate, outcomeNotes: text }).strict().parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const p = await pregnancy(tx, id);
      after(input.endedOn, p.confirmedOn, 'Loss');
      await cancelPregnancyTasks(tx, id);
      await tx.scheduledTask.updateMany({
        where: { breedingCycleId: p.breedingCycleId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await tx.breedingCycle.update({
        where: { id: p.breedingCycleId },
        data: { status: 'CLOSED_LOSS', closedOn: input.endedOn },
      });
      return tx.pregnancy.update({ where: { id }, data: { ...input, status: 'LOST' } });
    }),
  );
});
breedingRouter.post('/pregnancies/:id/calving', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      calvedAt: pastTime,
      assistanceLevel: text.optional(),
      totalBorn: z.number().int().min(1).max(10),
      bornAlive: z.number().int().min(0).max(10),
      stillborn: z.number().int().min(0).max(10),
      attendedBy: text.optional(),
      complications: notes,
      notes,
      calves: z
        .array(
          z
            .object({
              tagNumber: z.string().trim().min(1).max(50),
              sex: z.enum(['FEMALE', 'MALE']),
              name: text.optional(),
              breed: text.optional(),
            })
            .strict(),
        )
        .max(10)
        .default([]),
      postpartumCheckDueAt: time.optional(),
    })
    .strict()
    .parse(req.body);
  assert(input.totalBorn === input.bornAlive + input.stillborn, 'Birth counts must add up', 400);
  assert(
    input.calves.length === input.bornAlive,
    'Provide one calf profile for every live-born calf',
    400,
  );
  const { calves, postpartumCheckDueAt, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const p = await pregnancy(tx, id);
      after(data.calvedAt, p.confirmedOn, 'Calving');
      if (p.actualDryOffDate) after(data.calvedAt, p.actualDryOffDate, 'Calving');
      const birth = await tx.calving.create({ data: { ...data, pregnancyId: id } });
      for (const calf of calves)
        await tx.cow.create({
          data: {
            ...calf,
            category: 'CALF',
            origin: 'FARM_BORN',
            birthDate: day(data.calvedAt),
            motherId: p.cycle.cowId,
            birthCalvingId: birth.id,
          },
        });
      await tx.pregnancy.update({
        where: { id },
        data: { status: 'CALVED', endedOn: day(data.calvedAt) },
      });
      await tx.breedingCycle.update({
        where: { id: p.breedingCycleId },
        data: { status: 'CLOSED_CALVED', closedOn: day(data.calvedAt) },
      });
      await cancelPregnancyTasks(tx, id);
      await tx.scheduledTask.updateMany({
        where: { breedingCycleId: p.breedingCycleId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (postpartumCheckDueAt) {
        assert(postpartumCheckDueAt > data.calvedAt, 'Postpartum check must follow calving', 400);
        await tx.scheduledTask.create({
          data: {
            cowId: p.cycle.cowId,
            taskType: 'POSTPARTUM_CHECK',
            title: 'Postpartum veterinary follow-up',
            dueAt: postpartumCheckDueAt,
          },
        });
      }
      return tx.calving.findUnique({ where: { id: birth.id }, include: { calves: true } });
    }),
    'Calving and calf profiles recorded',
    201,
  );
});
