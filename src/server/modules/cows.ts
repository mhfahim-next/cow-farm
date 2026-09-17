import { createRoutes } from '../lib/router';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { db, transaction } from '../lib/db';
import {
  ok,
  text,
  notes,
  pastDate,
  money,
  uuid,
  paramId,
  pagination,
  paging,
  assert,
  day,
} from '../lib/http';
import { manage } from '../middleware/auth';
import { cow } from '../lib/domain';
export const cowsRouter = createRoutes();
const fields = z
  .object({
    tagNumber: z.string().trim().min(1).max(50),
    name: text.optional(),
    photoUrl: z.url().optional(),
    sex: z.enum(['FEMALE', 'MALE']),
    category: z.enum(['DAIRY', 'BEEF', 'HEIFER', 'CALF']),
    breed: text.optional(),
    birthDate: pastDate.optional(),
    birthDateEstimated: z.boolean().default(false),
    origin: z.enum(['PURCHASED', 'FARM_BORN']),
    purchaseDate: pastDate.optional(),
    purchasePrice: money.optional(),
    sellerName: text.optional(),
    motherId: uuid.optional(),
    sireDetails: text.optional(),
    notes,
  })
  .strict();
function validCow(c: {
  sex: string;
  category: string;
  birthDate?: Date | null;
  purchaseDate?: Date | null;
}) {
  assert(
    !(c.sex === 'MALE' && ['DAIRY', 'HEIFER'].includes(c.category)),
    'Male cattle cannot be dairy cows or heifers',
    400,
  );
  if (c.birthDate && c.purchaseDate)
    assert(c.purchaseDate >= c.birthDate, 'Purchase date must follow birth date', 400);
}
cowsRouter.get('/', async (req, res) => {
  const q = pagination
    .extend({
      search: z.string().max(120).optional(),
      status: z.enum(['ACTIVE', 'SOLD', 'DECEASED', 'TRANSFERRED']).optional(),
      category: z.enum(['DAIRY', 'BEEF', 'HEIFER', 'CALF']).optional(),
    })
    .parse(req.query);
  const where: Prisma.CowWhereInput = {
    status: q.status,
    category: q.category,
    ...(q.search
      ? {
          OR: [
            { tagNumber: { contains: q.search, mode: 'insensitive' } },
            { name: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [items, total] = await db.$transaction([
    db.cow.findMany({ where, ...paging(q), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    db.cow.count({ where }),
  ]);
  return ok(res, { items, total, page: q.page, limit: q.limit });
});
cowsRouter.post('/', manage, async (req, res) => {
  const input = fields.parse(req.body);
  validCow(input);
  const data = await transaction(async (tx) => {
    if (input.motherId) {
      const mother = await cow(tx, input.motherId, false);
      assert(mother.sex === 'FEMALE', 'Mother must be female', 400);
      if (mother.birthDate && input.birthDate)
        assert(input.birthDate > mother.birthDate, 'Calf must be younger than mother', 400);
    }
    return tx.cow.create({ data: input });
  });
  return ok(res, data, 'Cow created', 201);
});
cowsRouter.get('/:id', async (req, res) => {
  const id = paramId(req);
  await cow(db, id, false);
  const data = await db.cow.findUnique({
    where: { id },
    include: {
      mother: { select: { id: true, tagNumber: true } },
      calves: { select: { id: true, tagNumber: true } },
      cycles: { where: { status: { in: ['OPEN', 'PREGNANT'] } }, include: { pregnancy: true } },
      tasks: { where: { status: 'PENDING' }, orderBy: { dueAt: 'asc' }, take: 20 },
    },
  });
  const now = new Date();
  const restrictions = await db.treatment.findMany({
    where: {
      healthEvent: { cowId: id },
      OR: [
        {
          milkWithdrawalRequired: true,
          OR: [{ milkRestrictedUntil: null }, { milkRestrictedUntil: { gt: now } }],
        },
        {
          meatWithdrawalRequired: true,
          OR: [{ meatRestrictedUntil: null }, { meatRestrictedUntil: { gt: now } }],
        },
      ],
    },
    select: {
      id: true,
      productName: true,
      milkWithdrawalRequired: true,
      milkRestrictedUntil: true,
      meatWithdrawalRequired: true,
      meatRestrictedUntil: true,
    },
  });
  return ok(res, { ...data, withdrawalRestrictions: restrictions });
});
cowsRouter.patch('/:id', manage, async (req, res) => {
  const id = paramId(req);
  const input = fields
    .omit({ sex: true, origin: true, motherId: true })
    .partial()
    .refine((v) => Object.keys(v).length > 0, 'At least one field is required')
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const current = await cow(tx, id);
      validCow({ ...current, ...input });
      return tx.cow.update({ where: { id }, data: input });
    }),
  );
});
cowsRouter.post('/:id/exit', manage, async (req, res) => {
  const id = paramId(req);
  const input = z
    .object({ status: z.enum(['SOLD', 'DECEASED', 'TRANSFERRED']), exitDate: pastDate, notes })
    .strict()
    .parse(req.body);
  return ok(
    res,
    await transaction(async (tx) => {
      const current = await cow(tx, id);
      if (current.birthDate)
        assert(input.exitDate >= current.birthDate, 'Exit cannot precede birth', 400);
      assert(
        input.exitDate >= day(current.createdAt),
        'Exit cannot precede registration; correct historical imports before registration',
        400,
      );
      await tx.scheduledTask.updateMany({
        where: { cowId: id, status: 'PENDING' },
        data: { status: 'CANCELLED', completionNotes: `Cow ${input.status.toLowerCase()}` },
      });
      return tx.cow.update({
        where: { id },
        data: {
          status: input.status,
          exitDate: input.exitDate,
          ...(input.notes ? { notes: input.notes } : {}),
        },
      });
    }),
    'Cow archived; pending tasks cancelled',
  );
});
// UNION avoids loading an animal's entire history into memory. Bound parameters prevent SQL injection.
cowsRouter.get('/:id/timeline', async (req, res) => {
  const id = paramId(req);
  await cow(db, id, false);
  const q = pagination.parse(req.query);
  const events = Prisma.sql`
 SELECT h.id, 'HEAT' AS type, h."observedAt" AS "occurredAt", to_jsonb(h) AS details FROM "HeatObservation" h JOIN "BreedingCycle" c ON c.id=h."breedingCycleId" WHERE c."cowId"=${id}::uuid
 UNION ALL SELECT s.id,'BREEDING_SERVICE',s."performedAt",to_jsonb(s) FROM "BreedingService" s JOIN "BreedingCycle" c ON c.id=s."breedingCycleId" WHERE c."cowId"=${id}::uuid
 UNION ALL SELECT p.id,'PREGNANCY_CHECK',p."checkedAt",to_jsonb(p) FROM "PregnancyCheck" p JOIN "BreedingCycle" c ON c.id=p."breedingCycleId" WHERE c."cowId"=${id}::uuid
 UNION ALL SELECT p.id,'PREGNANCY_CONFIRMED',p."confirmedOn"::timestamptz,to_jsonb(p) FROM "Pregnancy" p JOIN "BreedingCycle" c ON c.id=p."breedingCycleId" WHERE c."cowId"=${id}::uuid
 UNION ALL SELECT p.id,'PREGNANCY_LOSS',p."endedOn"::timestamptz,to_jsonb(p) FROM "Pregnancy" p JOIN "BreedingCycle" c ON c.id=p."breedingCycleId" WHERE c."cowId"=${id}::uuid AND p.status='LOST'
 UNION ALL SELECT p.id,'DRY_OFF',p."actualDryOffDate"::timestamptz,to_jsonb(p) FROM "Pregnancy" p JOIN "BreedingCycle" c ON c.id=p."breedingCycleId" WHERE c."cowId"=${id}::uuid AND p."actualDryOffDate" IS NOT NULL
 UNION ALL SELECT b.id,'CALVING',b."calvedAt",to_jsonb(b) FROM "Calving" b JOIN "Pregnancy" p ON p.id=b."pregnancyId" JOIN "BreedingCycle" c ON c.id=p."breedingCycleId" WHERE c."cowId"=${id}::uuid
 UNION ALL SELECT h.id,'HEALTH_EVENT',h."occurredAt",to_jsonb(h) FROM "HealthEvent" h WHERE h."cowId"=${id}::uuid
 UNION ALL SELECT a.id,'TREATMENT_ADMINISTRATION',a."administeredAt",to_jsonb(a) FROM "TreatmentAdministration" a JOIN "Treatment" t ON t.id=a."treatmentId" JOIN "HealthEvent" h ON h.id=t."healthEventId" WHERE h."cowId"=${id}::uuid`;
  const [items, count] = await db.$transaction([
    db.$queryRaw(
      Prisma.sql`SELECT * FROM (${events}) events ORDER BY "occurredAt" DESC,id DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    ),
    db.$queryRaw<{ total: number }[]>(
      Prisma.sql`SELECT count(*)::int AS total FROM (${events}) events`,
    ),
  ]);
  return ok(res, { items, total: count[0].total, page: q.page, limit: q.limit });
});
