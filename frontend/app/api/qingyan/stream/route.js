import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

import { getConversations, saveConversations, getAgentSessions, saveAgentSessions } from '../../../../src/data/store'
import { loadAgentRegistry } from '../../_lib/agentRegistry'

const API_ROOT = 'https://chatglm.cn/chatglm/assistant-api/v1'

const debugLog = (...args) => {
  if (process.env.DEBUG_LOCAL === '1') console.log('[qingyan]', ...args)
}

const escapeForDisplay = (s) => {
  if (typeof s !== 'string') return ''
  // Make control characters visible in logs/UI.
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, (ch) => {
      const code = ch.charCodeAt(0).toString(16).padStart(2, '0')
      return `\\x${code}`
    })
}

// Upstream may sometimes send double-escaped strings (e.g. "\\u60a8\\u597d").
// Decode common backslash escapes so the user sees real UTF-8/Unicode text.
const decodeEscapedText = (s) => {
  if (typeof s !== 'string' || s.length === 0) return s
  let out = s
  if (out.includes('\\u')) {
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  }
  if (out.includes('\\n') || out.includes('\\r') || out.includes('\\t')) {
    out = out.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t')
  }
  return out
}

let cachedToken = null
let cachedTokenExpiresAt = 0

const sse = (encoder, obj) => {
  if (obj === '[DONE]') return encoder.encode('data: [DONE]\n\n')
  return encoder.encode(`data: ${JSON.stringify(obj)}\n\n`)
}

const pickAgent = (registry, agentName) => {
  if (agentName) {
    const found = registry.agents.find(a => a.name === agentName)
    if (found) return found
  }
  return registry.agents[0]
}

const touchAgentSession = (conversationId, agentName, agentId, createdAt) => {
  const now = Date.now()
  const sessions = getAgentSessions()
  const idx = sessions.findIndex(s => s?.conversationId === conversationId)
  const next = {
    conversationId,
    createdAt: Number(createdAt) || now,
    agentName: String(agentName || ''),
    agentId: String(agentId || ''),
    updatedAt: now,
  }
  if (idx === -1) sessions.push(next)
  else sessions[idx] = { ...sessions[idx], ...next }
  saveAgentSessions(sessions)
}

const getAccessToken = async (registry) => {
  const now = Date.now()
  if (cachedToken && now < cachedTokenExpiresAt - 60_000) return cachedToken

  debugLog('requesting access token via POST /get_token')

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
  // Spec lists access_token/expires_in; some responses wrap them under result.
  const token = data?.result?.access_token ?? data?.access_token
  const expiresIn = data?.result?.expires_in ?? data?.expires_in
  if (!token) throw new Error(data?.message || 'get_token: missing access_token')

  debugLog('get_token ok', {
    hasAccessToken: true,
    tokenLength: String(token).length,
    expiresIn,
  })

  cachedToken = token
  cachedTokenExpiresAt = now + (Number(expiresIn) || 0) * 1000
  return token
}

const safeJson = async (res) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}

const debugSuggestPromptsOnce = async ({ registry, token, conversationId, logId }) => {
  if (process.env.DEBUG_LOCAL !== '1') return
  if (!conversationId) return
  try {
    const body = { conversation_id: conversationId }
    if (logId) body.log_id = logId

    const res = await fetch(`${API_ROOT}/suggest/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const rawText = await res.text()
    const rawPreview = rawText.length > 4000 ? `${rawText.slice(0, 4000)}…(truncated)` : rawText
    debugLog('suggest/prompts raw response', {
      status: res.status,
      body: escapeForDisplay(rawPreview),
    })

    let json
    try {
      json = JSON.parse(rawText)
    } catch {
      json = { _raw: rawText }
    }
    const list = Array.isArray(json?.result?.list) ? json.result.list : []
    const decoded = list
      .filter(x => typeof x === 'string')
      .map(x => decodeEscapedText(x))

    debugLog('suggest/prompts', {
      status: res.status,
      conversation_id: conversationId,
      log_id: logId || null,
      list: decoded,
    })
  } catch (e) {
    debugLog('suggest/prompts failed', e?.message || String(e))
  }
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
        // ignore non-json data
      }
    }
  }
  return events
}

const longestCommonPrefixLen = (a, b) => {
  if (!a || !b) return 0
  const max = Math.min(a.length, b.length)
  let i = 0
  while (i < max && a.charCodeAt(i) === b.charCodeAt(i)) i++
  return i
}

const iterUpstreamSseDataLines = (chunkText, cb) => {
  const chunks = chunkText.split('\n\n')
  for (const block of chunks) {
    const lines = block.split('\n')
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data) continue
      cb(data)
    }
  }
}

// Per doc: read message.content.text. If message is empty -> skip.
const extractMessageContentText = (obj) => {
  const msg = obj?.result?.message ?? obj?.message
  if (!msg) return null
  const content = msg?.content
  // Common: { type: 'text', text: '...' }
  const text = content && typeof content === 'object' ? content?.text : null
  if (typeof text === 'string' && text.length > 0) return decodeEscapedText(text)
  // Fallback: content may be a string
  if (typeof content === 'string' && content.length > 0) return decodeEscapedText(content)
  return null
}

export async function POST(req) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json()
  const convId = body?.convId ?? body?.conversationId ?? body?.conversation_id
  const isInit = body?.init === true
  const rawMessage = body?.message ?? body?.prompt
  const message = (typeof rawMessage === 'string' ? rawMessage : '')
  const agentName = body?.agentName
  const assistantIdOverride = body?.assistant_id
  const conversationIdOverride = body?.conversation_id

  // Doc says prompt is required; for demo init, we send a minimal prompt to trigger greeting.
  const effectiveMessage = isInit
    ? (message.trim() ? message : '你好')
    : message

  if (!effectiveMessage || !effectiveMessage.trim()) {
    return NextResponse.json({ error: '消息为空' }, { status: 400 })
  }

  const all = getConversations()
  const conv = all.find(c => c.id === convId && c.userId === sid)
  if (!conv) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  let registry
  try {
    registry = loadAgentRegistry()
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'agent registry load failed' }, { status: 500 })
  }

  // Agent selection priority:
  // 1) explicit assistant_id override
  // 2) conversation's configured agentId/agentName
  // 3) request agentName
  // 4) first agent
  let agent
  if (assistantIdOverride) {
    const fromRegistry = registry.agents.find(a => a.id === assistantIdOverride)
    agent = fromRegistry || { id: String(assistantIdOverride), name: agentName || conv.agentName || 'assistant' }
  } else if (conv.agentId) {
    const fromRegistry = registry.agents.find(a => a.id === conv.agentId)
    agent = fromRegistry || { id: String(conv.agentId), name: conv.agentName || agentName || 'assistant' }
  } else {
    agent = pickAgent(registry, conv.agentName || agentName)
  }

  // Allow overriding upstream conversation_id per request (optional)
  if (conversationIdOverride) conv.agentConversationId = String(conversationIdOverride)

  // 记录本地对话（便于刷新后仍可见）
  const userMsgId = crypto.randomUUID()
  const aiMsgId = crypto.randomUUID()
  if (!isInit) {
    conv.messages.push({ id: userMsgId, role: 'user', text: effectiveMessage, ts: Date.now() })
  }
  conv.messages.push({ id: aiMsgId, role: 'ai', text: '', ts: Date.now(), agentId: agent.id, agentName: agent.name, init: isInit })
  conv.agentId = agent.id
  conv.agentName = agent.name
  conv.updatedAt = Date.now()
  saveConversations(all)
  touchAgentSession(conv.id, agent.name, agent.id, conv.createdAt)

  const encoder = new TextEncoder()
  const debugEnabled = process.env.DEBUG_LOCAL === '1'

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(sse(encoder, { type: 'meta', agentId: agent.id, agentName: agent.name }))

        const token = await getAccessToken(registry)

        debugLog('calling POST /stream', {
          hasAuthorizationHeader: Boolean(token),
          assistant_id: agent.id,
          hasConversationId: Boolean(conv.agentConversationId),
          promptProvided: typeof message === 'string' && message.length > 0,
        })

        const upstreamBody = {
          assistant_id: agent.id,
          conversation_id: conv.agentConversationId || undefined,
          prompt: effectiveMessage,
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

        debugLog('upstream /stream response', { status: upstreamRes.status })

        if (!upstreamRes.ok || !upstreamRes.body) {
          controller.enqueue(sse(encoder, { type: 'error', error: `upstream HTTP ${upstreamRes.status}` }))
          controller.enqueue(sse(encoder, '[DONE]'))
          controller.close()
          return
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

          if (debugEnabled) {
            iterUpstreamSseDataLines(ready, (dataLine) => {
              const trimmed = dataLine.length > 2000 ? `${dataLine.slice(0, 2000)}…(truncated)` : dataLine
              const escaped = escapeForDisplay(trimmed)
              debugLog('upstream sse data:', escaped)
            })
          }

          const events = parseUpstreamSseEvents(ready)
          for (const ev of events) {
            const status = ev?.result?.status ?? ev?.status
            const conversationId = ev?.result?.conversation_id ?? ev?.conversation_id
            const historyId = ev?.result?.history_id ?? ev?.history_id
            if (conversationId && conv.agentConversationId !== conversationId) {
              conv.agentConversationId = conversationId
              conv.updatedAt = Date.now()
              saveConversations(all)
              touchAgentSession(conv.id, agent.name, agent.id, conv.createdAt)
              controller.enqueue(sse(encoder, { type: 'meta', conversationId }))
            }

            // Persist latest upstream history_id for prompt suggestion endpoint (log_id).
            if (historyId && conv.agentLastHistoryId !== historyId) {
              conv.agentLastHistoryId = historyId
              saveConversations(all)
            }

            // If upstream signals error, abort stream immediately.
            const lastError = ev?.result?.last_error ?? ev?.last_error
            const lastErrorMsg = typeof lastError?.error_msg === 'string' ? lastError.error_msg : ''
            const lastErrorCode = typeof lastError?.error_code === 'string' ? lastError.error_code : ''
            const hasConcreteLastError = Boolean(lastErrorMsg || lastErrorCode)

            if (status === 'error' || hasConcreteLastError) {
              const errMsg = lastErrorMsg || lastErrorCode || 'error'

              controller.enqueue(sse(encoder, { type: 'error', error: errMsg }))

              // Persist whatever we have so far.
              const target = conv.messages.find(m => m.id === aiMsgId)
              if (target) target.text = finalText
              saveConversations(all)

              controller.enqueue(sse(encoder, '[DONE]'))
              controller.close()
              return
            }

            // Strict per doc: only use result.message.content.text.
            const text = extractMessageContentText(ev)
            if (typeof text === 'string') {
              if (debugEnabled) {
                const escapedText = escapeForDisplay(text)
                debugLog('extracted message.content.text:', escapedText)
              }

              // Delta strategy:
              // - If upstream sends cumulative text: append only the newly added suffix.
              // - If upstream sends incremental chunks: append the whole chunk.
              // Use longest-common-prefix to handle minor mismatches without duplicating everything.
              if (!lastText) {
                controller.enqueue(sse(encoder, { type: 'delta', delta: text }))
                lastText = text
              } else {
                const lcp = longestCommonPrefixLen(lastText, text)
                if (lcp > 0) {
                  // Likely cumulative (or partially overlapping) snapshot.
                  const delta = text.slice(lcp)
                  if (delta) controller.enqueue(sse(encoder, { type: 'delta', delta }))
                  lastText = text
                } else if (lastText.startsWith(text)) {
                  // Shorter/duplicate snapshot; ignore.
                } else {
                  // Likely incremental chunk.
                  controller.enqueue(sse(encoder, { type: 'delta', delta: text }))
                  lastText = lastText + text
                }
              }
              finalText = lastText
            }

            // Stream ends when status reaches finish.
            if (status === 'finish') {
              // 结束时落库
              const target = conv.messages.find(m => m.id === aiMsgId)
              if (target) target.text = finalText
              saveConversations(all)

              // Debug: after each conversation finishes, print suggest prompts once.
              // Uses conversation_id + history_id (as log_id) to hit cache when available.
              void debugSuggestPromptsOnce({
                registry,
                token,
                conversationId: conv.agentConversationId,
                logId: conv.agentLastHistoryId,
              })

              controller.enqueue(sse(encoder, '[DONE]'))
              controller.close()
              return
            }
          }
        }

        // reader 结束但没明确 finish：也做一次落库
        const target = conv.messages.find(m => m.id === aiMsgId)
        if (target) target.text = finalText
        saveConversations(all)

        controller.enqueue(sse(encoder, '[DONE]'))
        controller.close()
      } catch (e) {
        controller.enqueue(sse(encoder, { type: 'error', error: e?.message || 'error' }))
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
