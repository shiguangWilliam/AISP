"use client"
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isNullOrEmpty, isAvailEmail, isAbailPassword, isAbailUsername, isAvailVerifyCode } from '../../src/lib/paramCheck'

export default function RegisterPage() {
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [sending, setSending] = useState(false)
  const [values, setValues] = useState({ username: '', email: '', password: '', code: '' })
  const [fieldErrors, setFieldErrors] = useState({})
  const router = useRouter()

  const validateField = (name, nextValues) => {
    const v = nextValues[name]
    if (name === 'username') {
      if (isNullOrEmpty(v)) return '请输入用户名'
      if (!isAbailUsername(v)) return '用户名需为 3-30 位，仅字母/数字/下划线'
      return null
    }
    if (name === 'email') {
      if (isNullOrEmpty(v)) return '请输入邮箱'
      if (!isAvailEmail(v)) return '邮箱格式不正确'
      return null
    }
    if (name === 'password') {
      if (isNullOrEmpty(v)) return '请输入密码'
      if (!isAbailPassword(v)) return '密码至少 8 位，且包含大写字母、数字、特殊字符'
      return null
    }
    if (name === 'code') {
      if (isNullOrEmpty(v)) return '请输入验证码'
      if (!isAvailVerifyCode(v)) return '验证码为 6 位数字'
      return null
    }
    return null
  }

  const validateAll = (nextValues) => {
    const nextErrors = {}
    for (const name of ['username', 'email', 'password', 'code']) {
      const msg = validateField(name, nextValues)
      if (msg) nextErrors[name] = msg
    }
    return nextErrors
  }

  const setValue = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value }
      return next
    })
  }

  const onBlurField = (name) => {
    setFieldErrors((prev) => {
      const msg = validateField(name, values)
      const next = { ...prev }
      if (msg) next[name] = msg
      else delete next[name]
      return next
    })
  }

  const onSendCode = async (email) => {
    setError('')
    setInfo('')
    if (isNullOrEmpty(email) || !isAvailEmail(email)) {
      setFieldErrors((prev) => ({ ...prev, email: '请先输入正确的邮箱' }))
      return
    }

    setSending(true)
    try {
      const res = await fetch('/api/email/send-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || '发送失败')
        return
      }
      setInfo('验证码已发送，请查收邮箱')
    } finally {
      setSending(false)
    }
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')

    const nextErrors = validateAll(values)
    setFieldErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) })
    const data = await res.json()
    if (!res.ok) return setError(data.error || '注册失败')
    router.push('/profile')
  }
  return (
    <main className="container">
      <h2>创建账户</h2>
      {info ? <div className="success" aria-live="polite">{info}</div> : null}
      {error ? <div className="error" aria-live="polite">{error}</div> : null}
      <form className="form" onSubmit={onSubmit}>
        <label>
          用户名
          <input
            name="username"
            type="text"
            placeholder="用户名"
            required
            autoComplete="username"
            value={values.username}
            onChange={(e) => setValue('username', e.target.value)}
            onBlur={() => onBlurField('username')}
            className={fieldErrors.username ? 'input-error' : ''}
            aria-invalid={Boolean(fieldErrors.username)}
            aria-describedby={fieldErrors.username ? 'err-username' : undefined}
          />
          {fieldErrors.username ? <div id="err-username" className="field-error-text">{fieldErrors.username}</div> : null}
        </label>

        <label>
          邮箱
          <input
            name="email"
            type="email"
            placeholder="邮箱"
            required
            autoComplete="email"
            value={values.email}
            onChange={(e) => setValue('email', e.target.value)}
            onBlur={() => onBlurField('email')}
            className={fieldErrors.email ? 'input-error' : ''}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'err-email' : undefined}
          />
          {fieldErrors.email ? <div id="err-email" className="field-error-text">{fieldErrors.email}</div> : null}
        </label>

        <label>
          密码
          <input
            name="password"
            type="password"
            placeholder="密码"
            required
            autoComplete="new-password"
            value={values.password}
            onChange={(e) => setValue('password', e.target.value)}
            onBlur={() => onBlurField('password')}
            className={fieldErrors.password ? 'input-error' : ''}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'err-password' : undefined}
          />
          {fieldErrors.password ? <div id="err-password" className="field-error-text">{fieldErrors.password}</div> : null}
        </label>

        <label>
          验证码
          <input
            name="code"
            type="text"
            placeholder="6 位数字"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={values.code}
            onChange={(e) => setValue('code', e.target.value)}
            onBlur={() => onBlurField('code')}
            className={fieldErrors.code ? 'input-error' : ''}
            aria-invalid={Boolean(fieldErrors.code)}
            aria-describedby={fieldErrors.code ? 'err-code' : undefined}
          />
          {fieldErrors.code ? <div id="err-code" className="field-error-text">{fieldErrors.code}</div> : null}
        </label>
        <button
          className="btn ghost"
          type="button"
          disabled={sending}
          onClick={() => onSendCode(values.email)}
          aria-label="发送邮箱验证码"
        >
          {sending ? '发送中...' : '发送验证码'}
        </button>
        <button className="btn" type="submit" aria-label="注册并进入个人信息">注册</button>
      </form>
    </main>
  )
}
