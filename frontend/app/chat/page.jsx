"use client"
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function ChatPage() {
  const [convs, setConvs] = useState([])
  const [active, setActive] = useState(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState([])
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id')
  const activeConv = useMemo(() => active || convs.find(c => c.id === id), [active, convs, id])
  const visibleConvs = useMemo(() => {
    if (!query.trim()) return convs
    const q = query.trim().toLowerCase()
    return convs.filter(c => (c.title || '').toLowerCase().includes(q))
  }, [convs, query])

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/conversations')
      if (!res.ok) return setError('请先登录')
      const list = await res.json()
      setConvs(list)
      if (!id && list.length > 0) router.replace(`/chat?id=${list[0].id}`)
    })()
  }, [])
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

  const newConv = async (e) => {
    e?.preventDefault()
    const title = e?.currentTarget?.title?.value || '新问诊'
    const res = await fetch('/api/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
    const conv = await res.json()
    setConvs(prev => [conv, ...prev])
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
    if (!text.trim() || !activeConv) return
    const res = await fetch('/api/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ convId: activeConv.id, message: text }) })
    const updated = await res.json()
    setConvs(prev => prev.map(c => c.id === updated.id ? updated : c))
    setText('')
  }

  return (
    <main className="chat-layout">
      <aside className="sidebar">
        <div className="section-title">新建问诊</div>
        <form onSubmit={newConv} className="search-row">
          <input type="text" name="title" placeholder="问诊标题" className="search-input" />
          <button className="btn small" type="submit">新建</button>
        </form>
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
            {visibleConvs.map(c => (
              <li key={c.id} className={c.id === activeConv?.id ? 'active' : ''}>
                <div className="conv-item">
                  <a href={`/chat?id=${c.id}`} onClick={(e) => { e.preventDefault(); router.push(`/chat?id=${c.id}`); setActive(c) }}>{c.title}</a>
                  <button className="delete-btn" onClick={async () => {
                    const res = await fetch(`/api/conversations?id=${c.id}`, { method: 'DELETE' })
                    if (res.ok) {
                      setConvs(prev => prev.filter(x => x.id !== c.id))
                      if (activeConv?.id === c.id) {
                        const next = visibleConvs.find(x => x.id !== c.id)
                        if (next) router.push(`/chat?id=${next.id}`); else router.replace('/chat')
                      }
                    }
                  }}>删除</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <section className="chat">
        <header className="chat-header">
          <h3>{activeConv?.title || '问诊'}</h3>
          {activeConv ? <a className="btn small ghost" href={`/api/scores/generate?convId=${activeConv.id}`}>生成成绩</a> : null}
        </header>
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
          <input value={text} onChange={e => setText(e.target.value)} placeholder="输入问诊内容" aria-label="输入问诊内容" />
          <button className="btn" type="submit">发送</button>
        </form>
      </section>
    </main>
  )
}
