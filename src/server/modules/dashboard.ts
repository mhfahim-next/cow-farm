import { createRoutes } from '../lib/router';
import { db } from '../lib/db';
import { ok } from '../lib/http';
export const dashboardRouter = createRoutes();
dashboardRouter.get('/', async (_req, res) => {
  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86400000);
  const [
    activeCattle,
    byCategory,
    ongoingPregnancies,
    overdueTasks,
    upcomingTasks,
    expectedCalvings,
  ] = await db.$transaction([
    db.cow.count({ where: { status: 'ACTIVE' } }),
    db.cow.groupBy({
      by: ['category'],
      orderBy: { category: 'asc' },
      where: { status: 'ACTIVE' },
      _count: true,
    }),
    db.pregnancy.count({ where: { status: 'ONGOING', cycle: { cow: { status: 'ACTIVE' } } } }),
    db.scheduledTask.count({ where: { status: 'PENDING', dueAt: { lt: now } } }),
    db.scheduledTask.findMany({
      where: { status: 'PENDING', dueAt: { gte: now, lte: nextWeek } },
      include: { cow: { select: { tagNumber: true } } },
      orderBy: { dueAt: 'asc' },
      take: 20,
    }),
    db.pregnancy.findMany({
      where: {
        status: 'ONGOING',
        cycle: { cow: { status: 'ACTIVE' } },
        estimatedCalvingDate: { lte: nextWeek },
      },
      include: { cycle: { include: { cow: { select: { tagNumber: true } } } } },
      orderBy: { estimatedCalvingDate: 'asc' },
      take: 20,
    }),
  ]);
  return ok(res, {
    activeCattle,
    byCategory,
    ongoingPregnancies,
    overdueTasks,
    upcomingTasks,
    expectedCalvings,
  });
});
