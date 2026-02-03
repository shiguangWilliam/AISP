import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getAgents } from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

export async function GET() {
  const cookieStore = await cookies()
  const { sid } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  return NextResponse.json(getAgents())
}
