import type { ErrorRequestHandler } from '../lib/router';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { ApiError } from '../lib/http';
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  let status = 500,
    message = 'Internal server error',
    details: unknown;
  if (error instanceof ApiError) {
    status = error.status;
    message = error.message;
  } else if (error instanceof ZodError) {
    status = 400;
    message = 'Validation failed';
    details = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409;
      message = 'A unique record already exists';
    } else if (error.code === 'P2025') {
      status = 404;
      message = 'Record not found';
    } else if (['P2003', 'P2004', 'P2010'].includes(error.code)) {
      status = 409;
      message = 'Related record or database constraint violation';
    } else if (error.code === 'P2034') {
      status = 409;
      message = 'Concurrent update conflict; retry the request';
    }
  } else if (error instanceof SyntaxError) {
    status = 400;
    message = 'Invalid JSON body';
  } else if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === 'entity.too.large'
  ) {
    status = 413;
    message = 'Request body too large';
  }
  if (status === 500)
    console.error('Request failed:', error instanceof Error ? error.name : 'Unknown error');
  res
    .status(status)
    .json({ success: false, statusCode: status, message, ...(details ? { errors: details } : {}) });
};
