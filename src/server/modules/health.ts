import { createRoutes } from '../lib/router';
import { z } from 'zod';
import { db, transaction, type Tx } from '../lib/db';
import {
  ok,
  text,
  notes,
  pastTime,
  date,
  pastDate,
  time,
  money,
  uuid,
  paramId,
  pagination,
  paging,
  assert,
  ApiError,
  day,
} from '../lib/http';
import { cow, after } from '../lib/domain';
import { manage } from '../middleware/auth';
export const healthRouter = createRoutes();
async function event(tx: Tx, id: string) {
  const e = await tx.healthEvent.findUnique({ where: { id } });
  if (!e) throw new ApiError(404, 'Health event not found');
  await cow(tx, e.cowId);
  return e;
}
async function treatment(tx: Tx, id: string) {
  const t = await tx.treatment.findUnique({ where: { id }, include: { healthEvent: true } });
  if (!t) throw new ApiError(404, 'Treatment not found');
  await cow(tx, t.healthEvent.cowId);
  return t;
}
healthRouter.get('/events', async (req, res) => {
  const q = pagination
    .extend({
      cowId: uuid.optional(),
      eventType: z
        .enum(['ILLNESS', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'INJURY', 'OTHER'])
        .optional(),
    })
    .parse(req.query);
  const where = { cowId: q.cowId, eventType: q.eventType };
  const [items, total] = await db.$transaction([
    db.healthEvent.findMany({
      where,
      ...paging(q),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    }),
    db.healthEvent.count({ where }),
  ]);
  return ok(res, { items, total, page: q.page, limit: q.limit });
});
healthRouter.get('/events/:id', async (req, res) => {
  const data = await db.healthEvent.findUnique({
    where: { id: paramId(req) },
    include: {
      treatments: { include: { administrations: { orderBy: { administeredAt: 'asc' } } } },
    },
  });
  if (!data) throw new ApiError(404, 'Health event not found');
  return ok(res, data);
});
healthRouter.post('/events', async (req, res) => {
  const input = z
    .object({
      cowId: uuid,
      eventType: z.enum(['ILLNESS', 'VACCINATION', 'DEWORMING', 'CHECKUP', 'INJURY', 'OTHER']),
      occurredAt: pastTime,
      symptoms: notes,
      diagnosis: notes,
      veterinarianName: text.optional(),
      consultationCost: money.default(0),
      notes,
      followUpDueAt: time.optional(),
    })
    .strict()
    .parse(req.body);
  const { followUpDueAt, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const c = await cow(tx, data.cowId);
      if (c.birthDate) after(data.occurredAt, c.birthDate);
      const e = await tx.healthEvent.create({ data });
      if (followUpDueAt) {
        assert(followUpDueAt > data.occurredAt, 'Follow-up must follow event', 400);
        await tx.scheduledTask.create({
          data: {
            cowId: data.cowId,
            healthEventId: e.id,
            taskType: 'VET_FOLLOWUP',
            title: 'Veterinary follow-up',
            dueAt: followUpDueAt,
          },
        });
      }
      return e;
    }),
    'Health event recorded',
    201,
  );
});
healthRouter.post('/events/:id/resolve', manage, async (req, res) => {
  const id = paramId(req);
  const input = z.object({ resolvedAt: pastTime }).strict().parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const e = await event(tx, id);
      assert(!e.resolvedAt, 'Event already resolved');
      assert(input.resolvedAt >= e.occurredAt, 'Resolution must follow event', 400);
      return tx.healthEvent.update({ where: { id }, data: input });
    }),
  );
});
const withdrawal = {
  milkWithdrawalRequired: z.boolean(),
  meatWithdrawalRequired: z.boolean(),
  milkRestrictedUntil: time.nullable().optional(),
  meatRestrictedUntil: time.nullable().optional(),
};
healthRouter.post('/events/:id/treatments', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      treatmentType: z.enum(['MEDICATION', 'VACCINATION', 'DEWORMING', 'OTHER']),
      productName: text,
      targetDisease: text.optional(),
      prescribedInstructions: text,
      prescribedBy: text.optional(),
      startsOn: date,
      endsOn: date.optional(),
      ...withdrawal,
      milkWithdrawalRequired: z.boolean().default(false),
      meatWithdrawalRequired: z.boolean().default(false),
      notes,
      nextDueAt: time.optional(),
    })
    .strict()
    .parse(req.body);
  const { nextDueAt, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const e = await event(tx, id);
      assert(!e.resolvedAt, 'Cannot add treatment to a resolved event');
      after(data.startsOn, e.occurredAt, 'Treatment');
      if (data.endsOn) after(data.endsOn, data.startsOn, 'Treatment end');
      if (data.milkRestrictedUntil) {
        assert(data.milkWithdrawalRequired, 'Milk restriction requires withdrawal flag', 400);
        after(data.milkRestrictedUntil, data.startsOn, 'Milk restriction end');
      }
      if (data.meatRestrictedUntil) {
        assert(data.meatWithdrawalRequired, 'Meat restriction requires withdrawal flag', 400);
        after(data.meatRestrictedUntil, data.startsOn, 'Meat restriction end');
      }
      const t = await tx.treatment.create({ data: { ...data, healthEventId: id } });
      if (nextDueAt) {
        after(nextDueAt, data.startsOn, 'Next dose');
        await tx.scheduledTask.create({
          data: {
            cowId: e.cowId,
            treatmentId: t.id,
            taskType:
              data.treatmentType === 'VACCINATION'
                ? 'VACCINATION'
                : data.treatmentType === 'DEWORMING'
                  ? 'DEWORMING'
                  : 'TREATMENT',
            title: `Scheduled ${data.productName}`,
            dueAt: nextDueAt,
          },
        });
      }
      return t;
    }),
    'Treatment plan created',
    201,
  );
});
healthRouter.post('/treatments/:id/administrations', async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({
      administeredAt: pastTime,
      doseAmount: z.number().positive().max(999999999.999).multipleOf(0.001),
      doseUnit: text,
      route: text.optional(),
      productBatch: text.optional(),
      productExpiry: date.optional(),
      administeredBy: text.optional(),
      cost: money.default(0),
      notes,
      milkRestrictedUntil: time.optional(),
      meatRestrictedUntil: time.optional(),
    })
    .strict()
    .parse(req.body);
  const { milkRestrictedUntil, meatRestrictedUntil, ...data } = input;
  return ok(
    res,
    await transaction(async (tx) => {
      const t = await treatment(tx, id);
      assert(['PLANNED', 'ACTIVE'].includes(t.status), 'Treatment is closed');
      after(data.administeredAt, t.startsOn, 'Administration');
      if (t.endsOn)
        assert(
          day(data.administeredAt) <= t.endsOn,
          'Administration follows treatment end date',
          400,
        );
      if (data.productExpiry)
        assert(
          data.productExpiry >= day(data.administeredAt),
          'Product expired before administration',
          400,
        );
      const last = await tx.treatmentAdministration.findFirst({
        where: { treatmentId: id },
        orderBy: { administeredAt: 'desc' },
      });
      if (last)
        assert(
          data.administeredAt >= last.administeredAt,
          'Administrations must be entered chronologically',
          400,
        );
      if (t.milkWithdrawalRequired) {
        assert(
          milkRestrictedUntil && milkRestrictedUntil >= data.administeredAt,
          'Provide updated milk restriction end for this dose',
          400,
        );
        if (t.milkRestrictedUntil)
          assert(
            milkRestrictedUntil >= t.milkRestrictedUntil,
            'A new dose cannot shorten milk withdrawal',
            400,
          );
      } else assert(!milkRestrictedUntil, 'Treatment does not specify milk withdrawal', 400);
      if (t.meatWithdrawalRequired) {
        assert(
          meatRestrictedUntil && meatRestrictedUntil >= data.administeredAt,
          'Provide updated meat restriction end for this dose',
          400,
        );
        if (t.meatRestrictedUntil)
          assert(
            meatRestrictedUntil >= t.meatRestrictedUntil,
            'A new dose cannot shorten meat withdrawal',
            400,
          );
      } else assert(!meatRestrictedUntil, 'Treatment does not specify meat withdrawal', 400);
      await tx.treatment.update({
        where: { id },
        data: { status: 'ACTIVE', milkRestrictedUntil, meatRestrictedUntil },
      });
      return tx.treatmentAdministration.create({ data: { ...data, treatmentId: id } });
    }),
    'Administration recorded',
    201,
  );
});
healthRouter.post('/treatments/:id/close', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({ status: z.enum(['COMPLETED', 'STOPPED']), endsOn: pastDate, notes })
    .strict()
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const t = await treatment(tx, id);
      assert(['PLANNED', 'ACTIVE'].includes(t.status), 'Treatment is already closed');
      after(input.endsOn, t.startsOn, 'Treatment end');
      const last = await tx.treatmentAdministration.findFirst({
        where: { treatmentId: id },
        orderBy: { administeredAt: 'desc' },
      });
      if (last) after(input.endsOn, last.administeredAt, 'Treatment end');
      await tx.scheduledTask.updateMany({
        where: { treatmentId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      return tx.treatment.update({ where: { id }, data: input });
    }),
  );
});
