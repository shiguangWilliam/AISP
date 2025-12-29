import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getConversations, saveConversations } from '../../../src/data/store'

const aiReply = (text) => {
  const lower = text.toLowerCase()
  if (lower.includes('发烧') || lower.includes('发热')) return '请描述发热时长、最高体温、伴随寒战或出汗'
  if (lower.includes('咳') || lower.includes('咳嗽')) return '请描述咳嗽性质、频率、是否有痰及痰色'
  if (lower.includes('痛')) return '请给出疼痛部位、性质、程度与持续时间'
  return '请继续描述症状的起始时间、诱因、缓解加重因素、既往史与用药'
}

export async function POST(req) {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })
  const { convId, message } = await req.json()
  if (!message) return NextResponse.json({ error: '消息为空' }, { status: 400 })
  const all = getConversations()
  const conv = all.find(c => c.id === convId && c.userId === sid)
  if (!conv) return NextResponse.json({ error: '会话不存在' }, { status: 404 })
  conv.messages.push({ id: crypto.randomUUID(), role: 'user', text: message, ts: Date.now() })
  const reply = aiReply(message)
  conv.messages.push({ id: crypto.randomUUID(), role: 'ai', text: reply, ts: Date.now() })
  saveConversations(all)
  return NextResponse.json(conv)
}

