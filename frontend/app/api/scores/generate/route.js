import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { getConversations, getScores, saveScores } from '../../../../src/data/store'

const scoringKeywords = ['持续时间', '严重程度', '伴随症状', '既往史', '用药', '过敏', '体温', '疼痛评分']

export async function GET(req) {
  const sid = cookies().get('session')?.value
  if (!sid) return NextResponse.redirect(new URL('/login', req.url))
  const { searchParams } = new URL(req.url)
  const convId = searchParams.get('convId')
  const conv = getConversations().find(c => c.id === convId && c.userId === sid)
  if (!conv) return NextResponse.redirect(new URL('/chat', req.url))
  const text = conv.messages.map(m => m.text).join(' ')
  const covered = scoringKeywords.filter(k => text.includes(k)).length
  const score = Math.round((covered / scoringKeywords.length) * 100)
  const list = getScores()
  list.push({ id: crypto.randomUUID(), userId: sid, convId, score, covered, total: scoringKeywords.length, ts: Date.now() })
  saveScores(list)
  return NextResponse.redirect(new URL('/scores', req.url))
}

