import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../src/data/store'
import {
  isNullOrEmpty,
  isAvailEmail,
  isAbailPassword,
  isAbailUsername,
  isAvailVerifyCode,
} from '../../../src/lib/paramCheck'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3335'

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const { username = '', email, password, code } = body || {}

  if (isNullOrEmpty(username) || isNullOrEmpty(email) || isNullOrEmpty(password) || isNullOrEmpty(code)) {
    return NextResponse.json({ error: '请输入用户名、邮箱、密码和验证码' }, { status: 400 })
  }
  if (!isAvailEmail(email)) return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 })
  if (!isAbailUsername(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-30 characters long and contain only letters, numbers, and underscores.' },
      { status: 400 }
    )
  }
  if (!isAbailPassword(password)) {
    return NextResponse.json({ error: 'Password format is invalid.' }, { status: 400 })
  }
  if (!isAvailVerifyCode(code)) {
    return NextResponse.json({ error: 'Invalid code.' }, { status: 400 })
  }

  // 注册走后端（后端会在 /api/register 内部校验验证码）
  let registerRes
  let registerJson
  try {
    registerRes = await fetch(`${BACKEND_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, code }),
    })
    registerJson = await registerRes.json().catch(() => ({}))
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to call backend.' }, { status: 502 })
  }
  if (!registerRes.ok) {
    return NextResponse.json({ error: registerJson?.error || '注册失败' }, { status: registerRes.status })
  }

  // 注册成功后，自动登录拿 token（方便前端继续访问需要登录的页面）
  let loginRes
  let loginJson
  try {
    loginRes = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    loginJson = await loginRes.json().catch(() => ({}))
  } catch (e) {
    return NextResponse.json({ ok: true, note: 'Registered, but login failed.' })
  }
  if (!loginRes.ok) {
    return NextResponse.json({ ok: true, note: 'Registered, but login failed.', error: loginJson?.error }, { status: 200 })
  }

  const user = loginJson?.user
  const token = loginJson?.token
  if (!user?.id) {
    return NextResponse.json({ ok: true, note: 'Registered, but backend user missing.' }, { status: 200 })
  }

  // 兼容现有 profile/chat：同步 users.json
  try {
    const users = getUsers()
    const existing = users.find((u) => u.id === String(user.id) || u.email === user.email)
    if (existing) {
      existing.id = String(user.id)
      existing.email = user.email
      existing.username = user.username
      existing.name = existing.name || user.username
      existing.role = user.role
    } else {
      users.push({
        id: String(user.id),
        username: user.username,
        name: user.username,
        email: user.email,
        role: user.role,
        passwordHash: '',
        salt: '',
        school: '',
        year: '',
        createdAt: Date.now(),
      })
    }
    saveUsers(users)
  } catch {
    // ignore
  }

  const res = NextResponse.json(loginJson)
  res.cookies.set('session', String(user.id), { httpOnly: true, path: '/' })
  if (token) res.cookies.set('token', String(token), { httpOnly: true, path: '/' })
  return res
}

