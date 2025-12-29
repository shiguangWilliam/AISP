"use client"
import { useEffect, useState } from 'react'

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
          <tr><th>时间</th><th>分数</th><th>覆盖/总项</th></tr>
        </thead>
        <tbody>
          {scores.map(s => (
            <tr key={s.id}>
              <td>{new Date(s.ts).toLocaleString()}</td>
              <td>{s.score}</td>
              <td>{s.covered}/{s.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}

