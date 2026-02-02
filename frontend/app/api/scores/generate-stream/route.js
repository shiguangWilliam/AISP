import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

import { getConversations, saveConversations, getScores, saveScores } from '../../../../src/data/store'
import { loadAgentRegistry } from '../../_lib/agentRegistry'
import { parseMarkdownPipeTable, summarizeScoreTable } from '../../../../src/lib/markdownTable'

const API_ROOT = 'https://chatglm.cn/chatglm/assistant-api/v1'

let cachedToken = null
let cachedTokenExpiresAt = 0

const sse = (encoder, obj) => {
  if (obj === '[DONE]') return encoder.encode('data: [DONE]\n\n')
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
}

const getAccessToken = async (registry) => {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) return cachedToken

  const res = await fetch(`${API_ROOT}/get_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: registry.key, api_secret: registry.secret }),
  })

  if (!res.ok) {
    let details = ''
    try {
      details = await res.text()
    } catch {}
    throw new Error(`get_token failed: HTTP ${res.status}${details ? ` - ${details}` : ''}`)
  }

  const data = await res.json()
  const token = data?.result?.access_token ?? data?.access_token
  const expiresIn = data?.result?.expires_in ?? data?.expires_in
  if (!token) throw new Error(data?.message || 'get_token: missing access_token')

  cachedToken = token
  cachedTokenExpiresAt = now + (Number(expiresIn) || 0) * 1000
  return token
}

const parseUpstreamSseEvents = (chunkText) => {
  const events = []
  const chunks = chunkText.split('\n\n')
  for (const block of chunks) {
    const lines = block.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue
      if (data === '[DONE]') {
        events.push({ type: 'done' })
        continue
      }
      try {
        events.push(JSON.parse(data))
      } catch {
        // ignore
      }
    }
  }
  return events
}

const extractMessageContentText = (obj) => {
  const msg = obj?.result?.message ?? obj?.message
  if (!msg) return null
  const content = msg?.content
  const text = content && typeof content === 'object' ? content?.text : null
  if (typeof text === 'string' && text.length > 0) return text
  if (typeof content === 'string' && content.length > 0) return content
  return null
}

const longestCommonPrefixLen = (a, b) => {
  if (!a || !b) return 0
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

const fallbackKeywordScore = ({ conv, sid, convId, scoreId, now }) => {
  const scoringKeywords = ['持续时间', '严重程度', '伴随症状', '既往史', '用药', '过敏', '体温', '疼痛评分']
  const text = (conv?.messages || []).map(m => m.text).join(' ')
  const covered = scoringKeywords.filter(k => text.includes(k)).length
  const score = Math.round((covered / scoringKeywords.length) * 100)
  return {
    id: scoreId,
    userId: sid,
    convId,
    mode: 'keyword-mock',
    score,
    covered,
    total: scoringKeywords.length,
    ts: now,
  }
}

export async function GET(req) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const convId = searchParams.get('convId')
  if (!convId) return NextResponse.json({ error: '缺少 convId' }, { status: 400 })

  const all = getConversations()
  const conv = all.find(c => c.id === convId && c.userId === sid)
  if (!conv) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  const encoder = new TextEncoder()
  const now = Date.now()
  const scoreId = crypto.randomUUID()

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse(encoder, { type: 'meta', convId, scoreId }))

        let registry
        try {
          registry = loadAgentRegistry()
        } catch (e) {
          const record = fallbackKeywordScore({ conv, sid, convId, scoreId, now })
          const list = getScores()
          list.push(record)
          saveScores(list)
          controller.enqueue(sse(encoder, { type: 'done', scoreId, mode: 'keyword-mock' }))
          controller.enqueue(sse(encoder, '[DONE]'))
          controller.close()
          return
        }

        const assistantId = String(conv.agentId || registry.agents[0]?.id || '')
        if (!assistantId) throw new Error('missing assistant id')

        const prompt = [
          '你是“问诊评分助手”。请基于【本次对话】对医生的问诊表现进行评分。',
          '要求：',
          '1) 只输出一个 Markdown 表格，不要输出任何额外文字（包括解释、结尾、注意事项）。',
          '2) 表格列名固定为：项目 | 得分 | 扣分原因 | 改进建议',
          '3) 得分必须填写数字（允许 0），不要留空。',
          '4) 项目中如果包含“（X分）”，请按该满分给分。最后一行必须是“**总计（100分）**”。',
          '5) 扣分原因/改进建议要具体、可执行、与对话内容相关。',
          '现在开始输出表格：',
        ].join('\n')

        const token = await getAccessToken(registry)

        const upstreamBody = {
          assistant_id: assistantId,
          conversation_id: conv.agentConversationId || undefined,
          prompt,
        }

        const upstreamRes = await fetch(`${API_ROOT}/stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(upstreamBody),
        })

        if (!upstreamRes.ok || !upstreamRes.body) {
          throw new Error(`upstream HTTP ${upstreamRes.status}`)
        }

        const reader = upstreamRes.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let lastText = ''
        let finalText = ''

        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lastDoubleNewline = buffer.lastIndexOf('\n\n')
          if (lastDoubleNewline === -1) continue

          const ready = buffer.slice(0, lastDoubleNewline)
          buffer = buffer.slice(lastDoubleNewline + 2)

          const events = parseUpstreamSseEvents(ready)
          for (const ev of events) {
            const status = ev?.result?.status ?? ev?.status
            const conversationId = ev?.result?.conversation_id ?? ev?.conversation_id
            const historyId = ev?.result?.history_id ?? ev?.history_id

            if (conversationId && conv.agentConversationId !== conversationId) {
              conv.agentConversationId = conversationId
              conv.updatedAt = Date.now()
              saveConversations(all)
              controller.enqueue(sse(encoder, { type: 'meta', conversationId }))
            }

            if (historyId && conv.agentLastHistoryId !== historyId) {
              conv.agentLastHistoryId = historyId
              saveConversations(all)
            }

            const lastError = ev?.result?.last_error ?? ev?.last_error
            const lastErrorMsg = typeof lastError?.error_msg === 'string' ? lastError.error_msg : ''
            const lastErrorCode = typeof lastError?.error_code === 'string' ? lastError.error_code : ''
            if (status === 'error' || lastErrorMsg || lastErrorCode) {
              throw new Error(lastErrorMsg || lastErrorCode || 'upstream error')
            }

            const text = extractMessageContentText(ev)
            if (typeof text === 'string') {
              if (!lastText) {
                controller.enqueue(sse(encoder, { type: 'delta', delta: text }))
                lastText = text
              } else {
                const lcp = longestCommonPrefixLen(lastText, text)
                if (lcp > 0) {
                  const delta = text.slice(lcp)
                  if (delta) controller.enqueue(sse(encoder, { type: 'delta', delta }))
                  lastText = text
                } else if (lastText.startsWith(text)) {
                  // ignore shorter snapshot
                } else {
                  controller.enqueue(sse(encoder, { type: 'delta', delta: text }))
                  lastText = lastText + text
                }
              }
              finalText = lastText
            }

            if (status === 'finish') {
              const table = parseMarkdownPipeTable(finalText)
              const summary = summarizeScoreTable(table)

              const record = {
                id: scoreId,
                userId: sid,
                convId,
                mode: 'agent-md',
                ts: now,
                score: summary?.totalScore ?? null,
                reportMd: finalText,
                report: {
                  headers: table?.headers || [],
                  rows: table?.rows || [],
                  summary: summary || null,
                },
              }

              const list = getScores()
              list.push(record)
              saveScores(list)

              controller.enqueue(sse(encoder, { type: 'done', scoreId, mode: 'agent-md' }))
              controller.enqueue(sse(encoder, '[DONE]'))
              controller.close()
              return
            }
          }
        }

        // If upstream ends without finish: still persist whatever we got.
        const table = parseMarkdownPipeTable(finalText)
        const summary = summarizeScoreTable(table)

        const record = {
          id: scoreId,
          userId: sid,
          convId,
          mode: 'agent-md',
          ts: now,
          score: summary?.totalScore ?? null,
          reportMd: finalText,
          report: {
            headers: table?.headers || [],
            rows: table?.rows || [],
            summary: summary || null,
          },
        }

        const list = getScores()
        list.push(record)
        saveScores(list)

        controller.enqueue(sse(encoder, { type: 'done', scoreId, mode: 'agent-md' }))
        controller.enqueue(sse(encoder, '[DONE]'))
        controller.close()
      } catch (e) {
        controller.enqueue(sse(encoder, { type: 'error', error: e?.message || 'error' }))
        // Fall back to keyword score to avoid dead-end UX.
        try {
          const record = fallbackKeywordScore({ conv, sid, convId, scoreId, now })
          const list = getScores()
          list.push(record)
          saveScores(list)
          controller.enqueue(sse(encoder, { type: 'done', scoreId, mode: 'keyword-mock' }))
        } catch {}
        controller.enqueue(sse(encoder, '[DONE]'))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
