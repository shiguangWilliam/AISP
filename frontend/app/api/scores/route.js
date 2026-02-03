import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getScores } from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

export async function GET() {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const list = (bypass ? getScores() : getScores().filter(s => s.userId === sid)).sort((a, b) => (b.ts || 0) - (a.ts || 0))
  return NextResponse.json(list)
}

