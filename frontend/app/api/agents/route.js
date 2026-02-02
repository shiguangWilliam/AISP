import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getAgents } from '../../../src/data/store'

export async function GET() {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  return NextResponse.json(getAgents())
}
