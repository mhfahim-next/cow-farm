import 'dotenv/config';
import { z } from 'zod';
// Keep initialization lazy: a build must not need a running database or production secrets.
let cached: ReturnType<typeof parse> | undefined;
function parse() {
  const result = z
    .object({
      DATABASE_URL: z.url().refine((v) => /^postgres(ql)?:/.test(v), 'PostgreSQL URL required'),
      DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
      JWT_SECRET: z.string(),
    })
    .parse(process.env);
  if (result.JWT_SECRET.startsWith('replace-with'))
    throw new Error(
      'Set JWT_SECRET in .env to your existing backend secret or a new random secret',
    );
  return result;
}
function config() {
  return (cached ??= parse());
}
export const env = {
  get DATABASE_URL() {
    return config().DATABASE_URL;
  },
  get DATABASE_POOL_SIZE() {
    return config().DATABASE_POOL_SIZE;
  },
  get JWT_SECRET() {
    return config().JWT_SECRET;
  },
};
