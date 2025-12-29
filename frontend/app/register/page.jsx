"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [error, setError] = useState('')
  const router = useRouter()
  const onSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const payload = Object.fromEntries(form.entries())
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    if (!res.ok) return setError(data.error || '注册失败')
    router.push('/profile')
  }
  return (
    <main className="container">
      <h2>创建账户</h2>
      {error ? <div className="error" aria-live="polite">{error}</div> : null}
      <form className="form" onSubmit={onSubmit}>
        <label>姓名<input name="name" type="text" placeholder="姓名" autoComplete="name" /></label>
        <label>邮箱<input name="email" type="email" placeholder="邮箱" required autoComplete="email" /></label>
        <label>密码<input name="password" type="password" placeholder="密码" required autoComplete="new-password" /></label>
        <label>学校<input name="school" type="text" placeholder="学校" autoComplete="organization" /></label>
        <label>年级<input name="year" type="text" placeholder="年级" /></label>
        <button className="btn" type="submit" aria-label="注册并进入个人信息">注册</button>
      </form>
    </main>
  )
}
