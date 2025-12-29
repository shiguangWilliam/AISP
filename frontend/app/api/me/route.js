import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUsers } from '../../../src/data/store'

export async function GET() {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const user = getUsers().find(u => u.id === sid)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { passwordHash, salt, ...safe } = user
  return NextResponse.json(safe)
}

