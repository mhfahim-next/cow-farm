/** A small route registry used inside native Next.js Route Handlers.
 * It does not open a server or depend on Express. Handlers retain a shared
 * request/response interface so the existing validation and transactions stay intact.
 */
import { NextResponse } from 'next/server';
import type { Role } from '../generated/prisma/client';
export type Request = {
  params: Record<string, string>;
  query: Record<string, string | string[]>;
  body: unknown;
  headers: { authorization?: string };
  user?: { id: string; role: Role; name: string; email: string };
};
export class Response {
  statusCode = 200;
  output?: NextResponse;
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(body: unknown) {
    this.output = NextResponse.json(body, {
      status: this.statusCode,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
    });
    return this;
  }
}
export type RequestHandler = (
  req: Request,
  res: Response,
  next: () => void,
) => unknown | Promise<unknown>;
export type ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: () => void,
) => unknown;
type Route = { method: string; path: string; handlers: RequestHandler[] };
export function createRoutes() {
  const routes: Route[] = [];
  const middleware: RequestHandler[] = [];
  return {
    routes,
    middleware,
    use(...handlers: RequestHandler[]) {
      middleware.push(...handlers);
    },
    get(path: string, ...handlers: RequestHandler[]) {
      routes.push({ method: 'GET', path, handlers });
    },
    post(path: string, ...handlers: RequestHandler[]) {
      routes.push({ method: 'POST', path, handlers });
    },
    patch(path: string, ...handlers: RequestHandler[]) {
      routes.push({ method: 'PATCH', path, handlers });
    },
  };
}
export function matchRoute(template: string, path: string) {
  const expected = template.split('/').filter(Boolean);
  const actual = path.split('/').filter(Boolean);
  if (expected.length !== actual.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = actual[i];
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}
export async function runHandlers(handlers: RequestHandler[], req: Request, res: Response) {
  for (const handler of handlers) {
    let continued = false;
    await handler(req, res, () => {
      continued = true;
    });
    if (res.output) return;
    if (!continued) throw new Error('Handler did not produce a response');
  }
}
