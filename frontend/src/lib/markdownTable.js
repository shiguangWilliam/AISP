const stripOuterPipes = (line) => {
  let s = String(line || '').trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s
}

const splitRow = (line) => {
  const core = stripOuterPipes(line)
  // NOTE: This is a minimal parser; it doesn't try to handle escaped pipes.
  return core.split('|').map(c => c.trim())
}

const isSeparatorRow = (line) => {
  const core = stripOuterPipes(line)
  if (!core) return false
  // Markdown table separator row like: --- | :---: | ---:
  return core
    .split('|')
    .every(seg => /^:?-{3,}:?$/.test(seg.trim()))
}

const findFirstTableAt = (lines) => {
  for (let i = 0; i < lines.length - 1; i++) {
    const headerLine = lines[i]
    const sepLine = lines[i + 1]
    if (!headerLine.includes('|')) continue
    if (!isSeparatorRow(sepLine)) continue
    return i
  }
  return -1
}

export const parseMarkdownPipeTable = (markdown) => {
  const text = typeof markdown === 'string' ? markdown : ''
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)

  const start = findFirstTableAt(lines)
  if (start === -1) return { headers: [], rows: [] }

  const headers = splitRow(lines[start]).filter(Boolean)
  const rows = []

  for (let j = start + 2; j < lines.length; j++) {
    const rowLine = lines[j]
    if (!rowLine.includes('|')) break
    if (isSeparatorRow(rowLine)) continue

    const cols = splitRow(rowLine)
    if (cols.every(c => !c)) continue

    const obj = {}
    for (let k = 0; k < headers.length; k++) {
      obj[headers[k]] = cols[k] ?? ''
    }
    obj._cols = cols
    rows.push(obj)
  }

  return { headers, rows }
}

const toNumberOrNull = (s) => {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  const re = /-?\d+(?:\.\d+)?/g
  const m = re.exec(t)
  if (!m) return null
  const n = Number(m[0])
  return Number.isFinite(n) ? n : null
}

const extractMaxPoints = (itemName) => {
  const s = String(itemName || '')
  // 支持：项目（15分） / 项目(15分)
  const re = /[（(]\s*(\d+)\s*分\s*[）)]/g
  const m = re.exec(s)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export const summarizeScoreTable = (table) => {
  const headers = Array.isArray(table?.headers) ? table.headers : []
  const rows = Array.isArray(table?.rows) ? table.rows : []

  const colItem = headers.find(h => h.includes('项目')) || headers[0] || '项目'
  const colScore = headers.find(h => h.includes('得分')) || headers[1] || '得分'
  const colReason = headers.find(h => h.includes('扣分')) || headers[2] || '扣分原因'
  const colAdvice = headers.find(h => h.includes('建议')) || headers[3] || '改进建议'

  const items = rows
    .map(r => {
      const name = r?.[colItem] ?? r?._cols?.[0] ?? ''
      const score = toNumberOrNull(r?.[colScore] ?? r?._cols?.[1])
      const reason = String(r?.[colReason] ?? r?._cols?.[2] ?? '').trim()
      const advice = String(r?.[colAdvice] ?? r?._cols?.[3] ?? '').trim()
      const max = extractMaxPoints(name)
      const isTotal = /总计/.test(name)
      return { name, score, max, reason, advice, isTotal }
    })
    .filter(x => x.name)

  const totalRow = items.find(x => x.isTotal)
  const totalScore = totalRow?.score ?? null

  // If no explicit total, try summing.
  const sumScore = items.filter(x => !x.isTotal && typeof x.score === 'number').reduce((a, b) => a + b.score, 0)

  let resolvedTotal = null
  if (typeof totalScore === 'number') resolvedTotal = totalScore
  else if (Number.isFinite(sumScore) && sumScore > 0) resolvedTotal = Math.round(sumScore)

  return {
    totalScore: resolvedTotal,
    items,
    columns: { item: colItem, score: colScore, reason: colReason, advice: colAdvice },
  }
}
