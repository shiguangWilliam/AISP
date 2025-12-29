import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUsers, saveUsers } from '../../../src/data/store'

export async function POST(req) {
  const body = await req.json()
  const { name = '', email, password, school = '', year = '' } = body || {}
  if (!email || !password) return NextResponse.json({ error: '请输入邮箱与密码' }, { status: 400 })
  const users = getUsers()
  if (users.find(u => u.email === email)) return NextResponse.json({ error: '该邮箱已注册' }, { status: 400 })
  const id = crypto.randomUUID()
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = crypto.createHmac('sha256', salt).update(password).digest('hex')
  const user = { id, name, email, passwordHash, salt, school, year, createdAt: Date.now() }
  users.push(user)
  saveUsers(users)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('session', id, { httpOnly: true, path: '/' })
  return res
}

