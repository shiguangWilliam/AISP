"use client"
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function ScoresPage() {
  const [scores, setScores] = useState([])
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/scores')
      if (res.ok) setScores(await res.json())
    })()
  }, [])
  return (
    <main className="container">
      <h2>成绩分析</h2>
      <table className="table">
        <thead>
          <tr><th>时间</th><th>分数</th><th>类型</th><th>操作</th></tr>
        </thead>
        <tbody>
          {scores.map(s => (
            <tr key={s.id}>
              <td>{new Date(s.ts).toLocaleString()}</td>
              <td>{typeof s.score === 'number' ? s.score : '-'}</td>
              <td>{s.mode === 'agent-md' ? '智能体' : '本地回退'}</td>
              <td><Link className="btn small ghost" href={`/scores/${s.id}`}>查看报告</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

