/**
 * @deprecated — PHP proxy route removed.
 *
 * The PHP backend proxy has been replaced by Next.js API routes
 * that query MySQL (Hostinger) directly via Prisma 7.
 *
 * All API routes now live under:
 *   /api/auth/*
 *   /api/admin/*
 *   /api/products/*
 *   /api/orders/*
 *   ... etc.
 *
 * This file is kept as a 404 stub so any stale bookmarks or links
 * return a clean error instead of a runtime exception.
 */

import { NextResponse } from 'next/server';

export async function GET()    { return gone(); }
export async function POST()   { return gone(); }
export async function PUT()    { return gone(); }
export async function PATCH()  { return gone(); }
export async function DELETE() { return gone(); }

function gone() {
  return NextResponse.json(
    { status: 'error', message: 'This proxy endpoint has been removed. Use the new /api/* routes.' },
    { status: 410 },
  );
}
