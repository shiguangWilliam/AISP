export const isNullOrEmpty = (param) => {
  return param == null || String(param).trim().length === 0
}

export const isAvailEmail = (email) => {
  const s = email == null ? '' : String(email)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return emailRegex.test(s)
}

export const isAbailPassword = (password) => {
  const s = password == null ? '' : String(password)

  const largeLetterRegex = /[A-Z]/
  const digitRegex = /\d/
  const specialCharRegex = /[!@#$%^&*(),.?:{}|<>]/

  if (!largeLetterRegex.test(s)) return false
  if (!digitRegex.test(s)) return false
  if (!specialCharRegex.test(s)) return false

  return s.length >= 8
}

export const isAbailUsername = (username) => {
  const s = username == null ? '' : String(username)
  const usernameRegex = /^\w+$/
  if (!usernameRegex.test(s)) return false
  return s.length >= 3 && s.length <= 30
}

export const isAvailVerifyCode = (code) => {
  const s = code == null ? '' : String(code).trim()
  return /^\d{6}$/.test(s)
}
