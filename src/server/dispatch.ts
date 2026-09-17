import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { authRouter, usersRouter } from './modules/auth';
import { cowsRouter } from './modules/cows';
import { breedingRouter } from './modules/breeding';
import { healthRouter } from './modules/health';
import { tasksRouter } from './modules/tasks';
import { dashboardRouter } from './modules/dashboard';
import { authenticate } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { ApiError } from './lib/http';
import { Response, matchRoute, runHandlers, type Request } from './lib/router';
const groups = {
  auth: authRouter,
  users: usersRouter,
  cows: cowsRouter,
  breeding: breedingRouter,
  health: healthRouter,
  tasks: tasksRouter,
  dashboard: dashboardRouter,
};
export async function dispatch(request: NextRequest, path: string, token?: string) {
  const res = new Response();
  const req: Request = {
    params: {},
    query: {},
    body: undefined,
    headers: { authorization: token ? `Bearer ${token}` : undefined },
  };
  try {
    for (const key of new Set(request.nextUrl.searchParams.keys())) {
      const values = request.nextUrl.searchParams.getAll(key);
      req.query[key] = values.length === 1 ? values[0] : values;
    }
    if (!['GET', 'HEAD'].includes(request.method)) {
      if (!request.headers.get('content-type')?.includes('application/json'))
        throw new ApiError(415, 'Content-Type must be application/json');
      // Bound streaming input, rather than trusting Content-Length.
      const reader = request.body?.getReader();
      let text = '';
      let size = 0;
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > 262144) {
            await reader.cancel();
            throw new ApiError(413, 'Request body too large');
          }
          text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
      }
      req.body = text ? JSON.parse(text) : {};
    }
    const parts = path.split('/').filter(Boolean);
    const name = parts.shift() as keyof typeof groups;
    const router = groups[name];
    if (!router) throw new ApiError(404, 'Route not found');
    const endpoint = '/' + parts.join('/');
    const route = router.routes.find(
      (r) => r.method === request.method && matchRoute(r.path, endpoint) !== null,
    );
    if (!route) throw new ApiError(404, 'Route not found');
    req.params = matchRoute(route.path, endpoint)!;
    await runHandlers(
      [
        ...(name === 'auth' || name === 'users' ? [] : [authenticate]),
        ...router.middleware,
        ...route.handlers,
      ],
      req,
      res,
    );
  } catch (error) {
    errorHandler(error, req, res, () => {});
  }
  return (
    res.output ??
    NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  );
}
