/* eslint-disable react/prop-types */
import { cookies } from 'next/headers'
import Link from 'next/link'

import { getScores, getConversations } from '../../../src/data/store'
import { resolveSid } from '../../../src/lib/devAuth'

const ScoreBar = ({ value, max }) => {
  const v = typeof value === 'number' ? value : null
  const m = typeof max === 'number' ? max : null
  const pct = v != null && m ? Math.max(0, Math.min(100, Math.round((v / m) * 100))) : null

  return (
    <div className="scorebar">
      <div className="scorebar-track">
        <div className="scorebar-fill" style={{ width: pct == null ? '0%' : `${pct}%` }} />
      </div>
      <div className="scorebar-meta">
        <span className="scorebar-num">{v == null ? '-' : v}{m ? ` / ${m}` : ''}</span>
        <span className="scorebar-pct">{pct == null ? '' : `${pct}%`}</span>
      </div>
    </div>
  )
}

export default async function ScoreDetailPage({ params }) {
  const cookieStore = await cookies()
  const { sid, bypass } = resolveSid(cookieStore.get('session')?.value)
  if (!sid) {
    return (
      <main className="container">
        <h2>成绩报告</h2>
        <div className="error">未登录</div>
      </main>
    )
  }

  const resolvedParams = await params
  const id = resolvedParams?.id
  const score = bypass
    ? getScores().find(s => s.id === id)
    : getScores().find(s => s.id === id && s.userId === sid)

  if (!score) {
    return (
      <main className="container">
        <h2>成绩报告</h2>
        <div className="error">报告不存在或无权限</div>
        <div style={{ marginTop: 12 }}>
          <Link className="btn ghost" href="/scores">返回列表</Link>
        </div>
      </main>
    )
  }

  const conv = getConversations().find(c => c.id === score.convId && c.userId === sid)
  const title = conv?.title || '问诊'

  const summary = score?.report?.summary
  const items = Array.isArray(summary?.items) ? summary.items : []
  let totalScore = null
  if (typeof summary?.totalScore === 'number') totalScore = summary.totalScore
  else if (typeof score.score === 'number') totalScore = score.score

  const good = items.filter(x => !x.isTotal && typeof x.score === 'number' && (x.max ? x.score / x.max >= 0.8 : x.score >= 4)).slice(0, 4)
  const bad = items.filter(x => !x.isTotal && (x.score == null || (x.max ? x.score / x.max < 0.6 : x.score <= 2))).slice(0, 4)

  return (
    <main className="container">
      <div className="report-head">
        <div>
          <h2 style={{ marginBottom: 6 }}>成绩报告</h2>
          <div className="muted">{title} · {new Date(score.ts).toLocaleString()}</div>
        </div>
        <div className="report-actions">
          <Link className="btn ghost" href="/scores">返回列表</Link>
          <Link className="btn" href={`/chat?id=${score.convId}`}>回到对话</Link>
        </div>
      </div>

      <div className="report-grid">
        <section className="card">
          <div className="kpi-title">总分</div>
          <div className="kpi-value">{totalScore == null ? '--' : totalScore}</div>
          <div className="kpi-sub">{score.mode === 'agent-md' ? '智能体评分（Markdown 表格）' : '本地关键词评分（回退）'}</div>
        </section>

        <section className="card">
          <div className="kpi-title">亮点（最多 4 项）</div>
          {good.length === 0 ? <div className="muted">暂无</div> : (
            <ul className="taglist">
              {good.map(x => <li key={x.name} className="tag good">{x.name}</li>)}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="kpi-title">优先改进（最多 4 项）</div>
          {bad.length === 0 ? <div className="muted">暂无</div> : (
            <ul className="taglist">
              {bad.map(x => <li key={x.name} className="tag bad">{x.name}</li>)}
            </ul>
          )}
        </section>
      </div>

      {score.mode === 'agent-md' && items.length > 0 ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>分项评分</h3>
          <div className="report-items">
            {items.filter(x => !x.isTotal).map(x => (
              <div key={x.name} className="report-item">
                <div className="report-item-head">
                  <div className="report-item-name">{x.name}</div>
                </div>
                <ScoreBar value={x.score} max={x.max || undefined} />
                {(x.reason || x.advice) ? (
                  <div className="report-item-notes">
                    {x.reason ? <div><span className="pill">扣分</span> {x.reason}</div> : null}
                    {x.advice ? <div><span className="pill">建议</span> {x.advice}</div> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {score.reportMd ? (
        <section className="card" style={{ marginTop: 18 }}>
          <h3 style={{ marginTop: 0 }}>原始 Markdown（兜底）</h3>
          <pre className="md-raw">{score.reportMd}</pre>
        </section>
      ) : null}
    </main>
  )
}
