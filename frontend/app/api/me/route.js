import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUsers } from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

export async function GET() {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  if (bypass) return NextResponse.json({ id: sid, name: '本地调试用户', email: null })

  const user = getUsers().find(u => u.id === sid)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { passwordHash, salt, ...safe } = user
  return NextResponse.json(safe)
}

