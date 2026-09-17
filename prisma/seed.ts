import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../src/server/lib/db';

async function main() {
  const input = z
    .object({
      SEED_OWNER_NAME: z.string().min(1),
      SEED_OWNER_EMAIL: z.email().toLowerCase(),
      SEED_OWNER_PASSWORD: z
        .string()
        .min(12)
        .max(72)
        .refine(
          (value) =>
            Buffer.byteLength(value) <= 72 &&
            !value.startsWith('replace-with'),
          'Set a strong owner password',
        ),
    })
    .parse(process.env);

  const existing = await db.farmUser.findUnique({
    where: { email: input.SEED_OWNER_EMAIL },
  });

  if (existing) {
    console.log('Account already exists; no password or role changed.');
    return;
  }

  await db.farmUser.create({
    data: {
      name: input.SEED_OWNER_NAME,
      email: input.SEED_OWNER_EMAIL,
      passwordHash: await bcrypt.hash(input.SEED_OWNER_PASSWORD, 12),
      role: 'OWNER',
    },
  });

  console.log('Owner account created.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });