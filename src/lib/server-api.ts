import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
export const cookieName = 'farm_session';
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.SESSION_COOKIE_SECURE === 'true',
  path: '/',
  maxAge: 8 * 60 * 60,
};
export function mutationAllowed(req: NextRequest) {
  return req.headers.get('origin') === (process.env.APP_ORIGIN || req.nextUrl.origin);
}
export function clearSession(response: NextResponse) {
  response.cookies.set(cookieName, '', { ...cookieOptions, maxAge: 0 });
  return response;
}
