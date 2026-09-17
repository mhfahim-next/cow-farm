import { PrismaClient, Prisma } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';
const globalForPrisma = globalThis as unknown as { farmPrisma?: PrismaClient };
function client() {
  if (!globalForPrisma.farmPrisma)
    globalForPrisma.farmPrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_SIZE }),
    });
  return globalForPrisma.farmPrisma;
}
// Lazy singleton avoids extra connection pools during Next.js development reloads.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
export type Tx = Prisma.TransactionClient;
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.$transaction(fn, { isolationLevel: 'Serializable', timeout: 15000 });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      )
        continue;
      throw error;
    }
  }
  throw new Error('Transaction retry exhausted');
}
