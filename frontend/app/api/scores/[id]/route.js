import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getScores } from '../../../../src/data/store'

export async function GET(_req, { params }) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const id = params?.id
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })

  const item = getScores().find(s => s.id === id && s.userId === sid)
  if (!item) return NextResponse.json({ error: '不存在' }, { status: 404 })

  return NextResponse.json(item)
}
