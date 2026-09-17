import { createRoutes } from '../lib/router';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from '../lib/rate-limit';
import { db } from '../lib/db';
import { env } from '../config/env';
import { ok, ApiError } from '../lib/http';
import { authenticate, roles } from '../middleware/auth';
export const authRouter = createRoutes();
const safe = { id: true, name: true, email: true, role: true, isActive: true } as const;
const credentials = z
  .object({ email: z.email().toLowerCase(), password: z.string().min(1).max(72) })
  .strict();
const dummyHash = bcrypt.hashSync('nonexistent-user-password', 12);
authRouter.post(
  '/login',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  async (req, res) => {
    const input = credentials.parse(req.body);
    const user = await db.farmUser.findUnique({ where: { email: input.email } });
    const valid = await bcrypt.compare(input.password, user?.passwordHash ?? dummyHash);
    if (!valid || !user?.isActive) throw new ApiError(401, 'Invalid email or password');
    const accessToken = jwt.sign({}, env.JWT_SECRET, {
      subject: user.id,
      expiresIn: '8h',
      algorithm: 'HS256',
      issuer: 'cow-farm-api',
      audience: 'cow-farm-client',
    });
    return ok(res, {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  },
);
authRouter.get('/me', authenticate, (req, res) => ok(res, req.user));
export const usersRouter = createRoutes();
usersRouter.use(authenticate, roles('OWNER'));
usersRouter.get('/', async (_req, res) =>
  ok(res, await db.farmUser.findMany({ select: safe, orderBy: { createdAt: 'desc' } })),
);
usersRouter.post('/', async (req, res) => {
  const input = credentials
    .extend({
      password: z
        .string()
        .min(12)
        .max(72)
        .refine((v) => Buffer.byteLength(v) <= 72, 'Password must be at most 72 UTF-8 bytes'),
      name: z.string().trim().min(1).max(120),
      role: z.enum(['MANAGER', 'WORKER']),
    })
    .parse(req.body);
  const { password, ...data } = input;
  return ok(
    res,
    await db.farmUser.create({
      data: { ...data, passwordHash: await bcrypt.hash(password, 12) },
      select: safe,
    }),
    'User created',
    201,
  );
});
