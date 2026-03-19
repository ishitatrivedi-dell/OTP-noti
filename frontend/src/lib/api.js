import { API_URL } from './config'

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
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

