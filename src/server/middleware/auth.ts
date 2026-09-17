import type { RequestHandler } from '../lib/router';
import jwt from 'jsonwebtoken';
import { db } from '../lib/db';
import { env } from '../config/env';
import { ApiError } from '../lib/http';
import type { Role } from '../generated/prisma/client';
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new ApiError(401, 'Bearer token required');
  let subject: string;
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'cow-farm-api',
      audience: 'cow-farm-client',
    });
    if (typeof decoded === 'string' || typeof decoded.sub !== 'string') throw new Error();
    subject = decoded.sub;
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
  const user = await db.farmUser.findUnique({ where: { id: subject } });
  if (!user?.isActive) throw new ApiError(401, 'Account unavailable');
  req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
  next();
};
export const roles =
  (...allowed: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || !allowed.includes(req.user.role))
      throw new ApiError(403, 'Insufficient permissions');
    next();
  };
export const manage = roles('OWNER', 'MANAGER');
