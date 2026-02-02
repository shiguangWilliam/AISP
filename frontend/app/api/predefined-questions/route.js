import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getAgents } from '../../../src/data/store'

const norm = (s) => (s || '').trim()

export async function GET(req) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const url = new URL(req.url)
  const agentId = norm(url.searchParams.get('agentId'))
  const agentName = norm(url.searchParams.get('agentName'))

  const agents = Array.isArray(getAgents()) ? getAgents() : []

  const findAgent = () => {
    if (agentId) return agents.find(a => a?.id === agentId)
    if (agentName) return agents.find(a => a?.name === agentName)
    return null
  }

  const agent = findAgent()

  if (!agentId && !agentName) {
    // 不传参则返回全部（便于前端缓存/选择）
    return NextResponse.json({ list: agents.map(a => ({
      id: a?.id || '',
      name: a?.name || '',
      predefined: a?.predefined || { questions: [] },
    })) })
  }

  if (!agent) return NextResponse.json({ error: '未找到智能体' }, { status: 404 })

  const questions = Array.isArray(agent?.predefined?.questions) ? agent.predefined.questions : []
  return NextResponse.json({ agentId: agent?.id || agentId, agentName: agent?.name || agentName, questions })
}
