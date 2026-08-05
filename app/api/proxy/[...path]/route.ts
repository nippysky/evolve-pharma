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
