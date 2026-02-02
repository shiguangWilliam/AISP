import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getConversations, saveConversations } from '../../../../src/data/store'
import { loadAgentRegistry } from '../../_lib/agentRegistry'

const API_ROOT = 'https://chatglm.cn/chatglm/assistant-api/v1'

const debugLog = (...args) => {
  if (process.env.DEBUG_LOCAL === '1') console.log('[qingyan:suggest]', ...args)
}

const escapeForDisplay = (s) => {
  if (typeof s !== 'string') return ''
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

const sseJson = async (res) => {
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { _raw: text }
  }
}

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

const getAccessToken = async (registry) => {
  const now = Date.now()
  if (cachedToken && cachedTokenExpiresAt - now > 60_000) return cachedToken

  debugLog('requesting access token via POST /get_token')
  const res = await fetch(`${API_ROOT}/get_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: registry.key, api_secret: registry.secret }),
  })
  const json = await sseJson(res)
  if (!res.ok || !json?.result?.access_token) {
    throw new Error(json?.message || json?.error || `获取 access_token 失败（HTTP ${res.status}）`)
  }

  const token = json.result.access_token
  const expiresIn = Number(json.result.expires_in || 0)
  cachedToken = token
  cachedTokenExpiresAt = now + (expiresIn > 0 ? expiresIn : 0)

  return token
}

export async function POST(req) {
  const cookieStore = await cookies()
  const sid = cookieStore.get('session')?.value
  if (!sid) return NextResponse.json({ error: '未登录' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const convId = body?.convId
  if (!convId) return NextResponse.json({ error: '缺少 convId' }, { status: 400 })

  const all = getConversations()
  const conv = all.find(c => c?.id === convId && c?.userId === sid)
  if (!conv) return NextResponse.json({ error: '会话不存在' }, { status: 404 })

  if (!conv.agentConversationId) {
    return NextResponse.json({ error: '该会话尚未建立上游 conversation_id（请先发送一句话或等待问候语完成）' }, { status: 400 })
  }

  const registry = loadAgentRegistry()
  if (!registry?.key || !registry?.secret) {
    return NextResponse.json({ error: '未配置清言 API 凭证' }, { status: 500 })
  }

  try {
    const token = await getAccessToken(registry)

    const upstreamBody = {
      conversation_id: conv.agentConversationId,
    }

    // 文档字段名为 log_id；我们使用流式事件里的 history_id 作为 log_id 缓存键。
    if (conv.agentLastHistoryId) upstreamBody.log_id = conv.agentLastHistoryId

    debugLog('calling POST /suggest/prompts', {
      hasConversationId: Boolean(upstreamBody.conversation_id),
      hasLogId: Boolean(upstreamBody.log_id),
    })

    const upstreamRes = await fetch(`${API_ROOT}/suggest/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(upstreamBody),
    })

    const rawText = await upstreamRes.text()
    const rawPreview = rawText.length > 4000 ? `${rawText.slice(0, 4000)}…(truncated)` : rawText
    debugLog('suggest/prompts raw response', {
      status: upstreamRes.status,
      body: escapeForDisplay(rawPreview),
    })

    let json
    try {
      json = JSON.parse(rawText)
    } catch {
      json = { _raw: rawText }
    }
    if (!upstreamRes.ok) {
      return NextResponse.json({ error: json?.message || json?.error || '获取推荐对话失败' }, { status: 502 })
    }

    const list = json?.result?.list
    const prompts = Array.isArray(list)
      ? list
          .filter(x => typeof x === 'string' && x.trim())
          .map(x => decodeEscapedText(x))
          .slice(0, 6)
      : []

    debugLog('suggest/prompts result', {
      status: upstreamRes.status,
      conversation_id: upstreamBody.conversation_id,
      log_id: upstreamBody.log_id || null,
      list: prompts,
    })

    // Touch updatedAt for local ordering (optional)
    conv.updatedAt = Date.now()
    saveConversations(all)

    return NextResponse.json({ list: prompts })
  } catch (e) {
    return NextResponse.json({ error: e?.message || '获取推荐对话失败' }, { status: 500 })
  }
}
