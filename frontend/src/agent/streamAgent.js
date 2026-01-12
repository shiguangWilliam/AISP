const parseSse = (text) => {
  const events = []
  const chunks = text.split('\n\n')
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
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
        events.push({ type: 'delta', delta: data })
      }
    }
  }
  return events
}

export async function streamAgentReply({
  convId,
  message,
  agentName,
  init,
  onDelta,
  onDone,
  onError,
  signal,
}) {
  try {
    const res = await fetch('/api/qingyan/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ convId, message, agentName, init: init === true }),
      signal,
    })

    if (!res.ok) {
      let msg = `HTTP ${res.status}`
      try {
        const j = await res.json()
        msg = j?.error || msg
      } catch {}
      throw new Error(msg)
    }

    if (!res.body) throw new Error('No response body')

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let abortedByError = false

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lastDoubleNewline = buffer.lastIndexOf('\n\n')
      if (lastDoubleNewline === -1) continue

      const ready = buffer.slice(0, lastDoubleNewline)
      buffer = buffer.slice(lastDoubleNewline + 2)

      const events = parseSse(ready)
      for (const ev of events) {
        if (ev.type === 'delta' && typeof ev.delta === 'string') onDelta?.(ev.delta)
        if (ev.type === 'done') onDone?.()
        if (ev.type === 'error') {
          abortedByError = true
          onError?.(ev.error || 'error')
          try { await reader.cancel() } catch {}
          break
        }
      }

      if (abortedByError) break
    }

    if (!abortedByError) onDone?.()
  } catch (e) {
    onError?.(e?.message || String(e))
  }
}
