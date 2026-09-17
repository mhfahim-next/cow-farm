import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/server/dispatch';
import { cookieName, mutationAllowed, clearSession } from '@/lib/server-api';
export const runtime = 'nodejs';
async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  if (req.method !== 'GET' && !mutationAllowed(req))
    return NextResponse.json({ message: 'Request origin rejected' }, { status: 403 });
  const path = (await ctx.params).path.join('/');
  if (!/^(cows|breeding|health|tasks|dashboard|users)(\/[a-zA-Z0-9-]+)*$/.test(path))
    return NextResponse.json({ message: 'Route not found' }, { status: 404 });
  const response = await dispatch(req, path, req.cookies.get(cookieName)?.value);
  return response.status === 401 ? clearSession(response) : response;
}
export { handler as GET, handler as POST, handler as PATCH };
