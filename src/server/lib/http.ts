import type { Response, Request } from '../lib/router';
import { z } from 'zod';
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function ok(res: Response, data: unknown, message = 'Success', status = 200) {
  return res.status(status).json({ success: true, statusCode: status, message, data });
}
export const uuid = z.uuid();
export const paramId = (req: Request) => uuid.parse(req.params.id);
export const text = z.string().trim().min(1).max(2000);
export const notes = z.string().trim().max(10000).optional();
export const date = z.iso.date().transform((v) => new Date(v + 'T00:00:00.000Z'));
export const time = z.iso.datetime({ offset: true }).transform((v) => new Date(v));
export const money = z.number().min(0).max(9999999999.99).multipleOf(0.01);
export const pastDate = date.refine((v) => v <= new Date(), 'Date cannot be in the future');
export const pastTime = time.refine((v) => v <= new Date(), 'Event cannot be in the future');
export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export function paging(q: { page: number; limit: number }) {
  return { skip: (q.page - 1) * q.limit, take: q.limit };
}
export function assert(condition: unknown, message: string, status = 409): asserts condition {
  if (!condition) throw new ApiError(status, message);
}
export const day = (d: Date) => new Date(d.toISOString().slice(0, 10) + 'T00:00:00.000Z');
