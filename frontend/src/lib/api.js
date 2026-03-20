import { API_URL } from './config'

// Token management
function getToken() {
  return localStorage.getItem('tbv_token')
}

function setToken(token) {
  localStorage.setItem('tbv_token', token)
}

function removeToken() {
  localStorage.removeItem('tbv_token')
}

async function request(path, { method = 'GET', body, requireAuth = false } = {}) {
  const headers = {}
  if (body) {
    headers['Content-Type'] = 'application/json'
  }
  
  if (requireAuth) {
    const token = getToken()
    if (!token) {
      throw new Error('Authentication required')
    }
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.message || `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return data
}

export function sendOtp(email) {
  return request('/api/auth/send-otp', { method: 'POST', body: { email } })
}

export function verifyOtp(email, otp) {
  return request('/api/auth/verify-otp', { method: 'POST', body: { email, otp } })
}

export function getCurrentUser() {
  return request('/api/users/me', { requireAuth: true })
}

export function updateProfile(data) {
  return request('/api/users/profile', { method: 'PUT', body: data, requireAuth: true })
}

export function fetchLogs({ limit = 200, action } = {}) {
  const qs = new URLSearchParams()
  if (limit) qs.set('limit', String(limit))
  if (action) qs.set('action', action)
  return request(`/api/logs?${qs.toString()}`)
}

export function fetchDailyActivity({ days = 7 } = {}) {
  return request(`/api/logs/daily-activity?days=${encodeURIComponent(String(days))}`)
}

export function fetchNotifications({ userId, limit = 20 }) {
  const qs = new URLSearchParams({ userId, limit: String(limit) })
  return request(`/api/notifications?${qs.toString()}`)
}

export function exportLogs({ format = 'json', limit = 1000, action } = {}) {
  const qs = new URLSearchParams({ format: String(format), limit: String(limit) })
  if (action) qs.set('action', action)
  
  const token = getToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(`${API_URL}/api/export/logs?${qs.toString()}`, {
    headers
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Export failed: ${res.status}`)
    }
    return res
  })
}

export function getAuthStatus() {
  const token = getToken()
  const headers = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  return fetch(`${API_URL}/api/auth-status/status`, {
    headers
  }).then(res => {
    if (!res.ok) {
      throw new Error(`Auth check failed: ${res.status}`)
    }
    return res.json()
  })
}

export { getToken, setToken, removeToken }

