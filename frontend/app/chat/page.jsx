"use client"
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { streamAgentReply } from '../../src/agent/streamAgent'

export default function ChatPage() {
  const [convs, setConvs] = useState([])
  const [sessions, setSessions] = useState([])
  const [agents, setAgents] = useState([])
  const [selectedAgentName, setSelectedAgentName] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [draftTitle, setDraftTitle] = useState('')
  const [draftAgentName, setDraftAgentName] = useState('')
  const [active, setActive] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const [sending, setSending] = useState(false)
  const [scoreModalOpen, setScoreModalOpen] = useState(false)
  const [scoreGenerating, setScoreGenerating] = useState(false)
  const [scoreProgress, setScoreProgress] = useState(0)
  const [scorePreview, setScorePreview] = useState('')
  const [scoreGenError, setScoreGenError] = useState('')
  const [didInitConvId, setDidInitConvId] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [suggestForConvId, setSuggestForConvId] = useState(null)
  const inputRef = useRef(null)
  const scoreEsRef = useRef(null)
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const activeConv = useMemo(() => active || convs.find(c => c.id === id), [active, convs, id])
  const activeAgent = useMemo(() => {
    if (!activeConv) return null
    const byId = activeConv?.agentId ? agents.find(a => a?.id === activeConv.agentId) : null
    if (byId) return byId
    const byName = activeConv?.agentName ? agents.find(a => a?.name === activeConv.agentName) : null
    return byName || null
  }, [activeConv, agents])
  const predefinedQuestions = useMemo(() => {
    const list = activeAgent?.predefined?.questions
    return Array.isArray(list) ? list.filter(s => typeof s === 'string' && s.trim()) : []
  }, [activeAgent])
  const showPredefined = useMemo(() => {
    const msgs = activeConv?.messages || []
    const hasUser = msgs.some(m => m?.role === 'user' && String(m?.text || '').trim())
    return !!activeConv && !hasUser && predefinedQuestions.length > 0
  }, [activeConv, predefinedQuestions])
  const visibleSessions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = Array.isArray(sessions) ? sessions : []
    if (!q) return list
    return list.filter(s => {
      const conv = convs.find(c => c.id === s.conversationId)
      const title = (conv?.title || '').toLowerCase()
      return title.includes(q)
    })
  }, [sessions, convs, query])

  useEffect(() => {
    (async () => {
      const [convsRes, sessionsRes, agentsRes] = await Promise.all([
        fetch('/api/conversations'),
        fetch('/api/agent-sessions'),
        fetch('/api/agents'),
      ])
      if (!convsRes.ok || !sessionsRes.ok || !agentsRes.ok) return setError('请先登录')

      const list = await convsRes.json()
      const sessionList = await sessionsRes.json()
      const agentList = await agentsRes.json()

      setConvs(list)
      setSessions(sessionList)
      setAgents(agentList)
      if (!selectedAgentName && agentList?.length > 0) setSelectedAgentName(agentList[0].name)

      if (!draftAgentName && agentList?.length > 0) setDraftAgentName(agentList[0].name)

      const firstId = sessionList?.[0]?.conversationId || list?.[0]?.id
      if (!id && firstId) router.replace(`/chat?id=${firstId}`)
    })()
  }, [])

  useEffect(() => {
    return () => {
      try {
        scoreEsRef.current?.close?.()
      } catch {}
      scoreEsRef.current = null
    }
  }, [])

  const startGenerateScore = () => {
    if (!activeConv?.id) return
    if (scoreGenerating) return

    setScoreGenError('')
    setScorePreview('')
    setScoreProgress(8)
    setScoreModalOpen(true)
    setScoreGenerating(true)

    const url = `/api/scores/generate-stream?convId=${encodeURIComponent(activeConv.id)}`

    try {
      scoreEsRef.current?.close?.()
    } catch {}

    const es = new EventSource(url)
    scoreEsRef.current = es
    let closed = false

    const close = () => {
      if (closed) return
      closed = true
      try {
        es.close()
      } catch {}
    }

    es.onmessage = (evt) => {
      if (!evt?.data) return
      if (evt.data === '[DONE]') {
        close()
        return
      }

      let json
      try {
        json = JSON.parse(evt.data)
      } catch {
        return
      }

      if (json?.type === 'delta' && typeof json.delta === 'string') {
        setScorePreview(prev => {
          const next = prev + json.delta
          const pct = Math.min(95, 8 + Math.min(87, Math.floor((next.length / 900) * 87)))
          setScoreProgress(pct)
          return next
        })
      } else if (json?.type === 'error') {
        setScoreGenError(String(json?.error || '生成失败'))
        setScoreProgress(100)
        close()
        setScoreGenerating(false)
      } else if (json?.type === 'done' && typeof json.scoreId === 'string') {
        setScoreProgress(100)
        close()
        setScoreGenerating(false)
        router.push(`/scores/${json.scoreId}`)
      }
    }

    es.onerror = () => {
      close()
      setScoreGenError('连接中断，请重试')
      setScoreGenerating(false)
    }
  }

  const loadSuggestions = async (convId) => {
    if (!convId) return
    const enableQingyanPlugin = process.env.NEXT_PUBLIC_QINGYAN_PLUGIN === '1'
    if (!enableQingyanPlugin) return
    try {
      const res = await fetch('/api/qingyan/suggest-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ convId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSuggestions([])
        setSuggestForConvId(convId)
        return
      }
      setSuggestions(Array.isArray(json?.list) ? json.list : [])
      setSuggestForConvId(convId)
    } catch {
      setSuggestions([])
      setSuggestForConvId(convId)
    }
  }

  useEffect(() => {
    if (!activeConv?.id) return
    loadSuggestions(activeConv.id)
  }, [activeConv?.id])

  useEffect(() => {
    if (!draftAgentName && agents?.length > 0) setDraftAgentName(agents[0].name)
  }, [agents, draftAgentName])

  useEffect(() => {
    const enableQingyanPlugin = process.env.NEXT_PUBLIC_QINGYAN_PLUGIN === '1'
    if (!enableQingyanPlugin) return
    if (!activeConv?.id) return
    if (sending) return

    const msgs = activeConv?.messages || []
    if (msgs.length > 0) return
    if (didInitConvId === activeConv.id) return

    setDidInitConvId(activeConv.id)
    setError('')
    setSending(true)

    const localAi = { id: crypto.randomUUID?.() || String(Date.now() + 1), role: 'ai', text: '', ts: Date.now(), init: true }
    const convId = activeConv.id

    setConvs(prev => prev.map(c => {
      if (c.id !== convId) return c
      return { ...c, messages: [...(c.messages || []), localAi] }
    }))

    const controller = new AbortController()

    ;(async () => {
      await streamAgentReply({
        convId,
        message: '',
        init: true,
        onDelta: (delta) => {
          setConvs(prev => prev.map(c => {
            if (c.id !== convId) return c
            const messages = (c.messages || []).map(m => {
              if (m.id !== localAi.id) return m
              return { ...m, text: (m.text || '') + delta }
            })
            return { ...c, messages }
          }))
        },
        onError: (msg) => {
          setError(msg)
          setSending(false)
        },
        onDone: () => {
          setSending(false)
          loadSuggestions(convId)
        },
        signal: controller.signal,
      })
    })()
  }, [activeConv?.id, didInitConvId, sending])
  useEffect(() => {
    try {
      const raw = localStorage.getItem('chat_search_history')
      if (raw) setHistory(JSON.parse(raw))
    } catch {}
  }, [])
  const pushHistory = (q) => {
    if (!q.trim()) return
    setHistory(prev => {
      const next = [q, ...prev.filter(i => i !== q)].slice(0, 6)
      try { localStorage.setItem('chat_search_history', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const openCreate = () => {
    setError('')
    setDraftTitle('')
    setDraftAgentName(selectedAgentName || agents?.[0]?.name || '')
    setShowCreate(true)
  }

  const createConv = async (e) => {
    e?.preventDefault()
    const agentName = draftAgentName || selectedAgentName || undefined
    const title = (draftTitle || '').trim()
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || undefined, agentName }),
    })
    const conv = await res.json()
    if (!res.ok) {
      setError(conv?.error || '新建失败')
      return
    }
    setError('')
    setConvs(prev => [conv, ...prev])
    setSessions(prev => {
      const now = Date.now()
      const item = {
        conversationId: conv.id,
        createdAt: conv.createdAt || now,
        agentName: conv.agentName || agentName || '',
        agentId: conv.agentId || '',
        updatedAt: conv.updatedAt || now,
      }
      const next = [item, ...(prev || []).filter(x => x?.conversationId !== conv.id)]
      return next.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    })
    setShowCreate(false)
    router.push(`/chat?id=${conv.id}`)
  }
  const doSearch = (e) => {
    e?.preventDefault()
    pushHistory(query)
  }
  const useTag = (t) => {
    setQuery(t)
    pushHistory(t)
  }

  const send = async (e) => {
    e.preventDefault()
    if (!text.trim() || !activeConv || sending) return

    const enableQingyanPlugin = process.env.NEXT_PUBLIC_QINGYAN_PLUGIN === '1'

    if (!enableQingyanPlugin) {
      setError('')
      setSending(true)
      try {
        const res = await fetch('/api/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ convId: activeConv.id, message: text }),
        })
        const updated = await res.json()
        if (!res.ok) {
          setError(updated?.error || '发送失败')
          return
        }
        setConvs(prev => prev.map(c => c.id === updated.id ? updated : c))
        setText('')
      } catch (err) {
        setError(err?.message || '发送失败')
      } finally {
        setSending(false)
      }
      return
    }

    setError('')
    setSending(true)

    const localUser = { id: crypto.randomUUID?.() || String(Date.now()), role: 'user', text, ts: Date.now() }
    const localAi = { id: crypto.randomUUID?.() || String(Date.now() + 1), role: 'ai', text: '', ts: Date.now() }
    const convId = activeConv.id
    const message = text

    setConvs(prev => prev.map(c => {
      if (c.id !== convId) return c
      return { ...c, messages: [...(c.messages || []), localUser, localAi] }
    }))
    setText('')

    const controller = new AbortController()

    await streamAgentReply({
      convId,
      message,
      init: false,
      onDelta: (delta) => {
        setConvs(prev => prev.map(c => {
          if (c.id !== convId) return c
          const messages = (c.messages || []).map(m => {
            if (m.id !== localAi.id) return m
            return { ...m, text: (m.text || '') + delta }
          })
          return { ...c, messages }
        }))
      },
      onError: (msg) => {
        setError(msg)
        setSending(false)
      },
      onDone: () => {
        setSending(false)
        loadSuggestions(convId)
      },
      signal: controller.signal,
    })
  }

  return (
    <main className="chat-layout">
      <aside className="sidebar">
        <div className="section-title">新建问诊</div>
        <button className="btn" type="button" onClick={openCreate}>新建</button>
        <div className="section-title">历史记录</div>
        <form onSubmit={doSearch} className="search-row">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜索会话标题" className="search-input" aria-label="搜索会话标题" />
          <button className="btn small ghost" type="submit">搜索</button>
        </form>
        {history.length > 0 ? (
          <div className="search-history">
            {history.map(t => <span key={t} className="tag" onClick={() => useTag(t)}>{t}</span>)}
            <span className="tag" onClick={() => { setHistory([]); try { localStorage.removeItem('chat_search_history') } catch {} }}>清空</span>
          </div>
        ) : null}
        <div className="conv-scroll">
          <ul className="conv-list">
            {visibleSessions.map(s => {
              const conv = convs.find(c => c.id === s.conversationId)
              const title = conv?.title || '新问诊'
              const convId = s.conversationId
              return (
                <li key={convId} className={convId === activeConv?.id ? 'active' : ''}>
                  <div className="conv-item">
                    <a
                      href={`/chat?id=${convId}`}
                      onClick={(e) => {
                        e.preventDefault()
                        router.push(`/chat?id=${convId}`)
                        if (conv) setActive(conv)
                      }}
                    >
                      {title}
                    </a>
                    <button className="delete-btn" onClick={async () => {
                      const res = await fetch(`/api/conversations?id=${convId}`, { method: 'DELETE' })
                      if (res.ok) {
                        setConvs(prev => prev.filter(x => x.id !== convId))
                        setSessions(prev => (prev || []).filter(x => x?.conversationId !== convId))
                        if (activeConv?.id === convId) {
                          const next = visibleSessions.find(x => x?.conversationId !== convId)
                          if (next?.conversationId) router.push(`/chat?id=${next.conversationId}`); else router.replace('/chat')
                        }
                      }
                    }}>删除</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </aside>
      <section className="chat">
        <header className="chat-header">
          <h3>{activeConv?.title || '问诊'}</h3>
          {activeConv ? (
            <button
              className="btn small ghost"
              type="button"
              disabled={scoreGenerating}
              onClick={startGenerateScore}
            >
              {scoreGenerating ? '生成中…' : '生成成绩'}
            </button>
          ) : null}
        </header>
        {error ? (
          <div className="error" role="alert" aria-live="assertive" style={{ margin: '12px 20px 0' }}>
            {error}
          </div>
        ) : null}
        <div className="messages" aria-live="polite">
          {activeConv?.messages?.map(m => (
            <div key={m.id} className={`message ${m.role}`}>
              <div className="bubble">{m.text}</div>
            </div>
          ))}
          {!activeConv && convs.length === 0 ? (
            <div className="bubble">暂无会话，点击左侧“新建问诊”开始练习</div>
          ) : null}
        </div>
        <form className="input-row" onSubmit={send}>
          <div style={{ display: 'grid', gap: 10 }}>
            {showPredefined ? (
              <div className="suggest-box" aria-label="预制初始问题">
                {predefinedQuestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="suggest-item"
                    onClick={() => {
                      setText(s)
                      queueMicrotask(() => inputRef.current?.focus?.())
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            {!showPredefined && suggestForConvId === activeConv?.id && suggestions.length > 0 ? (
              <div className="suggest-box" aria-label="下一步问题建议">
                {suggestions.map(s => (
                  <button
                    key={s}
                    type="button"
                    className="suggest-item"
                    onClick={() => {
                      setText(s)
                      queueMicrotask(() => inputRef.current?.focus?.())
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder="输入问诊内容" aria-label="输入问诊内容" />
          </div>
          <button className="btn" type="submit" disabled={sending}>{sending ? '发送中' : '发送'}</button>
        </form>
      </section>

      {showCreate ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="新建问诊"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreate(false)
          }}
        >
          <div className="modal">
            <div className="section-title">新建问诊</div>
            <form onSubmit={createConv} className="modal-form">
              <label className="modal-label">
                <div className="modal-label-text">选择智能体</div>
                <select
                  className="search-input"
                  value={draftAgentName}
                  onChange={(e) => setDraftAgentName(e.target.value)}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.name}>{a.name}</option>
                  ))}
                </select>
              </label>
              <label className="modal-label">
                <div className="modal-label-text">对话命名（可选）</div>
                <input
                  className="search-input"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="不填写则使用智能体名字"
                />
              </label>
              <div className="modal-actions">
                <button className="btn ghost" type="button" onClick={() => setShowCreate(false)}>取消</button>
                <button className="btn" type="submit">创建</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {scoreModalOpen ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="正在生成成绩">
          <div className="modal">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>正在生成成绩报告</div>
              <button className="link-btn" type="button" onClick={() => {
                setScoreModalOpen(false)
                setScoreGenError('')
              }}>隐藏</button>
            </div>

            <div className="progress" aria-label="生成进度" style={{ marginTop: 12 }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, scoreProgress))}%` }} />
              </div>
              <div className="progress-meta">
                <span className="muted">{scoreGenError ? '出错' : '智能体正在打分…'}</span>
                <span className="muted">{Math.max(0, Math.min(100, scoreProgress))}%</span>
              </div>
            </div>

            {scoreGenError ? (
              <div className="error" style={{ marginTop: 12 }}>{scoreGenError}</div>
            ) : null}

            {scorePreview ? (
              <pre className="md-raw" style={{ marginTop: 12, maxHeight: 220 }}>{scorePreview}</pre>
            ) : (
              <div className="loading-row" style={{ marginTop: 12 }}>
                <div className="spinner" aria-hidden="true" />
                <div className="muted">正在等待智能体返回评分表格…</div>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={() => startGenerateScore()} disabled={scoreGenerating}>重新生成</button>
              <button className="btn" type="button" onClick={() => {
                setScoreModalOpen(false)
                setScoreGenError('')
              }}>后台继续</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
