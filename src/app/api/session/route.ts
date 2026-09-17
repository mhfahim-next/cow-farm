import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/server/dispatch';
import { cookieName, cookieOptions, mutationAllowed, clearSession } from '@/lib/server-api';
export const runtime = 'nodejs';
export async function POST(req: NextRequest) {
  if (!mutationAllowed(req))
    return NextResponse.json({ message: 'Request origin rejected' }, { status: 403 });
  const result = await dispatch(req, 'auth/login');
  if (!result.ok) return result;
  const body = await result.json();
  const response = NextResponse.json(
    { success: true, data: body.data.user },
    { headers: { 'Cache-Control': 'no-store' } },
  );
  response.cookies.set(cookieName, body.data.accessToken, cookieOptions);
  return response;
}
export async function GET(req: NextRequest) {
  if (!req.cookies.get(cookieName)?.value)
    return NextResponse.json({ message: 'Please sign in' }, { status: 401 });
  const result = await dispatch(req, 'auth/me', req.cookies.get(cookieName)?.value);
  return result.status === 401 ? clearSession(result) : result;
}
export async function DELETE(req: NextRequest) {
  if (!mutationAllowed(req))
    return NextResponse.json({ message: 'Request origin rejected' }, { status: 403 });
  return clearSession(NextResponse.json({ success: true }));
}
