const USERS_KEY = 'resumeai.users'
const SESSION_KEY = 'resumeai.session'
const historyKey = (username) => `resumeai.history.${username.toLowerCase()}`

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadHistory(username) {
  return readJson(historyKey(username), [])
}

export function saveHistory(username, versions) {
  return writeJson(historyKey(username), versions)
}

export function currentUser() {
  return readJson(SESSION_KEY, null)
}

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password, salt) {
  if (!crypto.subtle) throw new Error('Login needs a secure connection (HTTPS or localhost).')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 },
    key,
    256
  )
  return toHex(bits)
}

function validateCredentials(username, password) {
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
    return 'Username must be 3–30 characters: letters, numbers, dot, dash or underscore.'
  }
  if (password.length < 6) return 'Password must be at least 6 characters.'
  return ''
}

export async function login(username, password) {
  const name = username.trim()
  const problem = validateCredentials(name, password)
  if (problem) throw new Error(problem)

  const users = readJson(USERS_KEY, {})
  const user = users[name.toLowerCase()]

  if (user) {
    if ((await hashPassword(password, user.salt)) !== user.hash) {
      throw new Error('Incorrect password for this username.')
    }
  } else {
    const salt = toHex(crypto.getRandomValues(new Uint8Array(16)))
    users[name.toLowerCase()] = { username: name, salt, hash: await hashPassword(password, salt) }
    if (!writeJson(USERS_KEY, users)) {
      throw new Error('Could not save your account. Browser storage may be full or disabled.')
    }
  }

  const displayName = user ? user.username : name
  if (!writeJson(SESSION_KEY, displayName)) {
    throw new Error('Could not log in. Browser storage may be full or disabled.')
  }
  return displayName
}

export function logout() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    return
  }
}
