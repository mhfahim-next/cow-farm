import { NextRequest, NextResponse } from 'next/server';
import { dispatch } from '@/server/dispatch';
export const runtime = 'nodejs';
// Token-only API for Postman/mobile clients. Never consumes cookies.
async function handler(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const path = (await ctx.params).path.join('/');
  if (!/^[a-zA-Z0-9/-]+$/.test(path))
    return NextResponse.json({ message: 'Route not found' }, { status: 404 });
  const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
  return dispatch(req, path, token);
}
export { handler as GET, handler as POST, handler as PATCH };
