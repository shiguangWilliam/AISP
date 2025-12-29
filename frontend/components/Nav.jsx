"use client"
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export default function Nav() {
  const [user, setUser] = useState(null)
  const pathname = usePathname()
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!mounted) return
        if (res.ok) setUser(await res.json())
        else setUser(null)
      } catch {
        setUser(null)
      }
    }
    load()
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { mounted = false; window.removeEventListener('focus', onFocus) }
  }, [pathname])
  if (!user) return null
  return (
    <nav className="nav">
      <div className="nav-left"><Link className="brand" href="/">MediSage 智医言犀</Link></div>
      <div className="nav-right">
        <Link href="/">主页</Link>
        {user ? (
          <>
            <Link href="/chat">问诊</Link>
            <Link href="/scores">成绩</Link>
            <Link href="/profile">个人信息</Link>
            <form action="/api/logout" method="post" style={{ display: 'inline' }}>
              <button className="link-btn" type="submit">退出</button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login">登录</Link>
            <Link className="primary" href="/register">注册</Link>
          </>
        )}
      </div>
    </nav>
  )
}
