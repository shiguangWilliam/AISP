import { NextResponse } from 'next/server'
import { isNullOrEmpty, isAvailEmail } from '../../../../src/lib/paramCheck'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3335'

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const email = body?.email

  if (isNullOrEmpty(email) || !isAvailEmail(email)) {
    return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  }

  try {
    const upstream = await fetch(
      `${BACKEND_URL}/api/register/get-email-verification-code?email=${encodeURIComponent(email)}`,
      { method: 'GET' }
    )

    const json = await upstream.json().catch(() => ({}))
    return NextResponse.json(json, { status: upstream.status })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to call backend.' }, { status: 502 })
  }
}
