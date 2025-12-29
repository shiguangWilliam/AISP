import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUsers } from '../../../src/data/store'

export async function POST(req) {
  const body = await req.json()
  const { email, password } = body || {}
  const users = getUsers()
  const user = users.find(u => u.email === email)
  if (!user) return NextResponse.json({ error: '用户不存在' }, { status: 404 })
  const hash = crypto.createHmac('sha256', user.salt).update(password).digest('hex')
  if (hash !== user.passwordHash) return NextResponse.json({ error: '密码错误' }, { status: 401 })
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', user.id, { httpOnly: true, path: '/' })
  return res
}

