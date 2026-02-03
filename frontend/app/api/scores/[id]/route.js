import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getScores } from '../../../../src/data/store'
import { resolveSid } from '../../../../src/lib/devAuth'

export async function GET(_req, { params }) {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const resolvedParams = await params
  const id = resolvedParams?.id
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const item = bypass
    ? getScores().find(s => s.id === id)
    : getScores().find(s => s.id === id && s.userId === sid)
  if (!item) return NextResponse.json({ error: '不存在' }, { status: 404 })

  return NextResponse.json(item)
}
