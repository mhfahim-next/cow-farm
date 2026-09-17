import { NextResponse } from 'next/server';
import { db } from '@/server/lib/db';
export const runtime = 'nodejs';
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      success: true,
      statusCode: 200,
      message: 'Success',
      data: { database: 'connected' },
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Database unavailable. Check DATABASE_URL, JWT_SECRET and the PostgreSQL service.',
      },
      { status: 503 },
    );
  }
}
