import { NextResponse } from 'next/server'
import { getUsers, saveUsers } from '../../../src/data/store'

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3335'

export async function POST(req) {
  const body = await req.json().catch(() => ({}))
  const { email = '', password = '' } = body || {}

  let backendRes
  let backendJson
  try {
    backendRes = await fetch(`${BACKEND_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    backendJson = await backendRes.json().catch(() => ({}))
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Failed to call backend.' }, { status: 502 })
  }

  if (!backendRes.ok) {
    return NextResponse.json({ error: backendJson?.error || '登录失败' }, { status: backendRes.status })
  }

  const user = backendJson?.user
  const token = backendJson?.token
  if (!user?.id) {
    return NextResponse.json({ error: 'Backend response missing user.' }, { status: 502 })
  }

  // 兼容现有前端（profile/chat 仍基于 users.json + session cookie）
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
    // 不阻断登录，只是本地资料页可能缺少数据
  }

  const res = NextResponse.json(backendJson)
  res.cookies.set('session', String(user.id), { httpOnly: true, path: '/' })
  if (token) res.cookies.set('token', String(token), { httpOnly: true, path: '/' })
  return res
}

