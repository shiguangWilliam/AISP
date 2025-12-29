"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [error, setError] = useState('')
  const router = useRouter()
  const onSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const payload = Object.fromEntries(form.entries())
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) return setError(data.error || '登录失败')
    router.push('/chat')
  }
  return (
    <main className="container">
      <h2>登录</h2>
      {error ? <div className="error" aria-live="polite">{error}</div> : null}
      <form className="form" onSubmit={onSubmit}>
        <label>邮箱<input name="email" type="email" placeholder="邮箱" required autoComplete="email" /></label>
        <label>密码<input name="password" type="password" placeholder="密码" required autoComplete="current-password" /></label>
        <button className="btn" type="submit" aria-label="登录并进入问诊">登录</button>
      </form>
    </main>
  )
}
