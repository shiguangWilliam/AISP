import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getConversations, saveConversations, getScores, saveScores } from '../../../src/data/store'

export async function GET() {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const list = getConversations().filter(c => c.userId === sid).sort((a, b) => b.createdAt - a.createdAt)
  return NextResponse.json(list)
}

export async function POST(req) {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { title = '新问诊' } = await req.json()
  const all = getConversations()
  const conv = { id: crypto.randomUUID(), userId: sid, title, messages: [], createdAt: Date.now() }
  all.push(conv)
  saveConversations(all)
  return NextResponse.json(conv)
}

export async function DELETE(req) {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少会话ID' }, { status: 400 })
  const all = getConversations()
  const idx = all.findIndex(c => c.id === id && c.userId === sid)
  if (idx === -1) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  all.splice(idx, 1)
  saveConversations(all)
  const scores = getScores().filter(s => !(s.convId === id && s.userId === sid))
  saveScores(scores)
  return NextResponse.json({ ok: true })
}
