import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import {
  getConversations,
  saveConversations,
  getScores,
  saveScores,
  getAgents,
  getAgentSessions,
  saveAgentSessions,
} from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

export async function GET() {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const list = bypass
    ? getConversations().filter(c => c && typeof c === 'object')
    : getConversations().filter(c => c && typeof c === 'object' && c.userId === sid)
  return NextResponse.json(list)
}

export async function POST(req) {
  const cookieStore = await cookies()
  const { sid } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { title, agentName } = await req.json()

  const agents = getAgents()
  const selected = agentName ? agents.find(a => a?.name === agentName) : agents[0]
  if (!selected) return NextResponse.json({ error: '无可用智能体' }, { status: 400 })

  const all = getConversations()
  const existingTitles = all
    .filter(c => c && typeof c === 'object' && c.userId === sid)
    .map(c => String(c.title || ''))

  const makeUniqueTitle = (base, titles) => {
    const trimmed = String(base || '').trim()
    const root = trimmed || '新问诊'

    let hasRoot = false
    let maxSuffix = 0
    const re = new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}（(\\d+)）$`)

    for (const t of titles) {
      if (t === root) {
        hasRoot = true
        continue
      }
      const m = String(t).match(re)
      if (m) maxSuffix = Math.max(maxSuffix, Number(m[1]) || 0)
    }
    if (!hasRoot && maxSuffix === 0) return root
    return `${root}（${Math.max(1, maxSuffix + 1)}）`
  }
  const now = Date.now()
  const baseTitle = (typeof title === 'string' && title.trim())
    ? title.trim()
    : (selected?.name || '新问诊')
  const finalTitle = makeUniqueTitle(baseTitle, existingTitles)
  const conv = {
    id: crypto.randomUUID(),
    userId: sid,
    title: finalTitle,
    messages: [],
    createdAt: now,
    updatedAt: now,
    agentName: selected.name,
    agentId: selected.id,
    agentConversationId: null,
  }
  all.push(conv)
  saveConversations(all)

  // Serialize agent session metadata for sidebar history.
  const sessions = getAgentSessions()
  sessions.push({
    conversationId: conv.id,
    createdAt: now,
    agentName: selected.name,
    agentId: selected.id,
    updatedAt: now,
  })
  saveAgentSessions(sessions)

  return NextResponse.json(conv)
}

export async function DELETE(req) {
  const cookieStore = await cookies()
  const { sid } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少会话ID' }, { status: 400 })
  const all = getConversations()
  const idx = all.findIndex(c => c.id === id && c.userId === sid)
  if (idx === -1) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  all.splice(idx, 1)
  saveConversations(all)

  const sessions = getAgentSessions().filter(x => x?.conversationId !== id)
  saveAgentSessions(sessions)

  const scores = getScores().filter(s => !(s.convId === id && s.userId === sid))
  saveScores(scores)
  return NextResponse.json({ ok: true })
}
