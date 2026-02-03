import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getAgentSessions, saveAgentSessions, getConversations } from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

export async function GET() {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const convs = bypass
    ? getConversations().filter(c => c && typeof c === 'object')
    : getConversations().filter(c => c && typeof c === 'object' && c.userId === sid)
  const sessions = getAgentSessions().filter(x => x && typeof x === 'object')
  const byId = new Map(sessions.map(s => [String(s.conversationId), s]))

  let changed = false
  for (const c of convs) {
    const id = String(c.id)
    if (!byId.has(id)) {
      byId.set(id, {
        conversationId: id,
        createdAt: Number(c.createdAt) || Date.now(),
        agentName: String(c.agentName || ''),
        agentId: String(c.agentId || ''),
        updatedAt: Number(c.updatedAt) || Number(c.createdAt) || Date.now(),
      })
      changed = true
    }
  }

  const nextAll = Array.from(byId.values())
  if (changed) saveAgentSessions(nextAll)

  const list = nextAll
    .filter(s => convs.some(c => String(c.id) === String(s.conversationId)))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))

  return NextResponse.json(list)
}

// Optional: allow manual patching (not used by UI right now)
export async function POST(req) {
  const cookieStore = await cookies()
  const { sid } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const item = await req.json()
  if (!item?.conversationId) return NextResponse.json({ error: '缺少会话id' }, { status: 400 })

  const all = getAgentSessions()
  const idx = all.findIndex(x => x.conversationId === item.conversationId)
  const now = Date.now()

  const next = {
    conversationId: String(item.conversationId),
    createdAt: Number(item.createdAt) || now,
    agentName: String(item.agentName || ''),
    agentId: String(item.agentId || ''),
    updatedAt: Number(item.updatedAt) || now,
  }

  if (idx === -1) all.push(next)
  else all[idx] = { ...all[idx], ...next }

  saveAgentSessions(all)
  return NextResponse.json(next)
}
