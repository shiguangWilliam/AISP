import './globals.css'
import Nav from '../components/Nav'
import { cookies } from 'next/headers'
import { getUsers } from '../src/data/store.js'

export const metadata = {
  title: '智医言犀 · MediSage',
  description: 'AI 大模型与医学生问诊训练平台',
}

export default function RootLayout({ children }) {
  const debug = process.env.DEBUG_LOCAL === '1'
  const sid = cookies().get('session')?.value
  const user = sid ? getUsers().find(u => u.id === sid) : null
  return (
    <html lang="zh-CN">
      <body>
        {debug ? (
          <div className="dev-banner">
            <span>本地调试模式已启用</span>
            {!user ? <a className="btn small ghost" href="/api/dev-login">一键进入本地调试账号</a> : null}
          </div>
        ) : null}
        {user ? <Nav /> : null}
        {children}
      </body>
    </html>
  )
}
