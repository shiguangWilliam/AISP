import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUsers, saveUsers } from '../../../src/data/store'

export async function PUT(req) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { name = '', school = '', year = '' } = await req.json()
  const users = getUsers()
  const user = users.find(u => u.id === sid)
  if (!user) return NextResponse.json({ error: '未登录' }, { status: 401 })
  user.name = name || user.name
  user.school = school || user.school
  user.year = year || user.year
  saveUsers(users)
  return NextResponse.json({ ok: true })
}

