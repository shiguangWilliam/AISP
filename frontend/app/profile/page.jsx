"use client"
import { useEffect, useState } from 'react'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [avatar, setAvatar] = useState('')
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/me')
      if (res.ok) {
        const data = await res.json()
        setUser(data)
        const letter = (data?.name || data?.email || 'U').slice(0, 1).toUpperCase()
        setAvatar(letter)
      }
      else setError('请先登录')
    })()
  }, [])
  const onSubmit = async (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const payload = Object.fromEntries(form.entries())
    const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    setSaved(res.ok)
  }
  return (
    <main className="container">
      <h2>个人信息</h2>
      {saved ? <div className="success" aria-live="polite">已保存</div> : null}
      {error ? <div className="error" aria-live="polite">{error}</div> : null}
      <div className="profile-card">
        <div className="profile-left">
          <div className="avatar">{avatar}</div>
          <button className="btn small ghost" type="button" aria-label="修改头像">更改头像</button>
        </div>
        <div className="profile-right">
          <form className="form" onSubmit={onSubmit}>
            <label>姓名<input name="name" type="text" defaultValue={user?.name || ''} autoComplete="name" /></label>
            <label>邮箱<input type="email" defaultValue={user?.email || ''} disabled /></label>
            <label>学校<input name="school" type="text" defaultValue={user?.school || ''} autoComplete="organization" /></label>
            <label>年级<input name="year" type="text" defaultValue={user?.year || ''} /></label>
            <button className="btn" type="submit" aria-label="保存个人信息">保存</button>
          </form>
        </div>
      </div>
    </main>
  )
}
