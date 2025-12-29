import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getScores } from '../../../src/data/store'

export async function GET() {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const list = getScores().filter(s => s.userId === sid).sort((a, b) => b.ts - a.ts)
  return NextResponse.json(list)
}

