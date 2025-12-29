import { NextResponse } from 'next/server'
import { getUsers, saveUsers, getConversations, saveConversations, getScores, saveScores } from '../../../src/data/store'
import crypto from 'crypto'

export async function GET(req) {
  if (process.env.DEBUG_LOCAL !== '1') return NextResponse.redirect(new URL('/', req.url))
  const users = getUsers()
  let user = users.find(u => u.email === 'dev@medisage.local')
  if (!user) {
    const id = 'dev-user-0001'
    const salt = crypto.randomBytes(16).toString('hex')
    const passwordHash = crypto.createHmac('sha256', salt).update('devpass').digest('hex')
    user = { id, name: '本地调试', email: 'dev@medisage.local', passwordHash, salt, school: '医学院（本地）', year: '2025', createdAt: Date.now() }
    users.push(user)
    saveUsers(users)
  }
  const convs = getConversations()
  if (!convs.find(c => c.userId === user.id)) {
    const conv = { id: 'dev-conv-001', userId: user.id, title: '示例问诊', messages: [
      { id: crypto.randomUUID(), role: 'user', text: '患者近两日发热伴乏力', ts: Date.now() - 3600_000 },
      { id: crypto.randomUUID(), role: 'ai', text: '请描述发热时长、最高体温、伴随寒战或出汗', ts: Date.now() - 3500_000 },
      { id: crypto.randomUUID(), role: 'user', text: '最高38.8℃，有寒战，服用对乙酰氨基酚稍缓解', ts: Date.now() - 3400_000 },
    ], createdAt: Date.now() }
    convs.push(conv)
    saveConversations(convs)
    const scores = getScores()
    scores.push({ id: crypto.randomUUID(), userId: user.id, convId: conv.id, score: 62, covered: 5, total: 8, ts: Date.now() })
    saveScores(scores)
  }
  const res = NextResponse.redirect(new URL('/chat?id=dev-conv-001', req.url))
  res.cookies.set('session', user.id, { httpOnly: true, path: '/' })
  return res
}

