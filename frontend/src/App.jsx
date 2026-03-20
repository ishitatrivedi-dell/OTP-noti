import { useEffect, useMemo, useState } from 'react'
import Panel from './components/Panel'
import { fetchDailyActivity, fetchLogs, fetchNotifications, sendOtp, verifyOtp, getCurrentUser, setToken, removeToken, exportLogs, getAuthStatus } from './lib/api'
import { emitUserAction, getSocket } from './lib/socket'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ''
  }
}

function AppContent() {
  const { theme, toggleTheme, themeClasses, inputThemes } = useTheme()
  
  const [email, setEmail] = useState(localStorage.getItem('tbv_email') || '')
  const [otp, setOtp] = useState('')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('tbv_user')
    return raw ? JSON.parse(raw) : null
  })
  const [token, setTokenState] = useState(localStorage.getItem('tbv_token') || null)

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)

  const [userActions, setUserActions] = useState([])
  const [logs, setLogs] = useState([])
  const [filterAction, setFilterAction] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activity, setActivity] = useState([])
  const [notifications, setNotifications] = useState([])

  const filteredLogs = useMemo(() => {
    let filtered = logs
    
    if (filterAction) {
      filtered = filtered.filter((l) => l.action === filterAction)
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((l) => 
        l.action.toLowerCase().includes(query) ||
        l.message.toLowerCase().includes(query) ||
        (l.meta && JSON.stringify(l.meta).toLowerCase().includes(query))
      )
    }
    
    return filtered
  }, [logs, filterAction, searchQuery])

  // Validate token on app load
  useEffect(() => {
    const validateAuth = async () => {
      setIsCheckingAuth(true)
      
      if (token && !user) {
        try {
          // First try to get current user (validates token)
          const data = await getCurrentUser()
          setUser(data.user)
          setToken(data.token) // Refresh token
          localStorage.setItem('tbv_user', JSON.stringify(data.user))
          localStorage.setItem('tbv_token', data.token)
        } catch (e) {
          // If getCurrentUser fails, check auth status
          try {
            const authStatus = await getAuthStatus()
            if (authStatus.authenticated && authStatus.user) {
              setUser(authStatus.user)
              emitUserAction('Session Restored', { email: authStatus.user.email })
            } else {
              // Token is invalid, clear it
              removeToken()
              setTokenState(null)
              localStorage.removeItem('tbv_user')
              emitUserAction('Session Expired', {})
            }
          } catch (statusError) {
            // Even auth status check failed, clear everything
            removeToken()
            setTokenState(null)
            localStorage.removeItem('tbv_user')
            emitUserAction('Auth Check Failed', {})
          }
        }
      } else if (!token && user) {
        // No token but user exists in state, clear user
        setUser(null)
        localStorage.removeItem('tbv_user')
      }
      
      setIsCheckingAuth(false)
    }
    
    validateAuth()
  }, [token, user])

  useEffect(() => {
    const s = getSocket()
    const onLog = (log) => setLogs((prev) => [log, ...prev].slice(0, 500))
    const onUserAction = (evt) =>
      setUserActions((prev) => [{ ...evt, _ts: Date.now() }, ...prev].slice(0, 100))

    s.on('log-update', onLog)
    s.on('user-action', onUserAction)
    return () => {
      s.off('log-update', onLog)
      s.off('user-action', onUserAction)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const [{ logs: initialLogs }, daily] = await Promise.all([
          fetchLogs({ limit: 200 }),
          fetchDailyActivity({ days: 7 }),
        ])
        setLogs(initialLogs)
        setActivity(daily.activity || [])
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const data = await fetchNotifications({ userId: user.id, limit: 20 })
        setNotifications(data.notifications || [])
      } catch {
        // ignore
      }
    })()
  }, [user?.id])

  async function onSendOtp() {
    setError('')
    setStatus('Sending OTP...')
    emitUserAction('Clicked Send OTP', { email })
    setUserActions((prev) => [{ action: 'Clicked Send OTP', email, _ts: Date.now() }, ...prev])
    try {
      localStorage.setItem('tbv_email', email)
      const data = await sendOtp(email)
      if (data.testMode && data.previewUrl) {
        setStatus(`OTP sent (test mode). Check console for preview URL: ${data.previewUrl}`)
      } else {
        setStatus('OTP sent successfully to your email!')
      }
    } catch (e) {
      setStatus('')
      setError(e.message)
    }
  }

  async function onVerifyOtp() {
    setError('')
    setStatus('Verifying OTP...')
    emitUserAction('Clicked Verify OTP', { email })
    setUserActions((prev) => [{ action: 'Clicked Verify OTP', email, _ts: Date.now() }, ...prev])
    try {
      const data = await verifyOtp(email, otp)
      const u = data.user
      const receivedToken = data.token
      
      setUser(u)
      setTokenState(receivedToken)
      localStorage.setItem('tbv_user', JSON.stringify(u))
      localStorage.setItem('tbv_token', receivedToken)
      setStatus('Verified. Welcome!')
      setOtp('')
    } catch (e) {
      setStatus('')
      setError(e.message)
    }
  }

  function logout() {
    setUser(null)
    setTokenState(null)
    localStorage.removeItem('tbv_user')
    localStorage.removeItem('tbv_token')
    emitUserAction('Logged out', {})
  }

  async function handleExport(format) {
    try {
      emitUserAction(`Export logs as ${format.toUpperCase()}`, {})
      const response = await exportLogs({ 
        format, 
        limit: 1000, 
        action: filterAction || undefined 
      })
      
      // Create download link
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`
      a.download = filename
      
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      setStatus(`Logs exported as ${format.toUpperCase()} successfully!`)
      setTimeout(() => setStatus(''), 3000)
    } catch (error) {
      setError(`Export failed: ${error.message}`)
    }
  }

  const actionsSet = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean))
    return Array.from(set).sort()

async function onSendOtp() {
  setError('')
  setStatus('Sending OTP...')
  emitUserAction('Clicked Send OTP', { email })
  setUserActions((prev) => [{ action: 'Clicked Send OTP', email, _ts: Date.now() }, ...prev])
  try {
    localStorage.setItem('tbv_email', email)
    const data = await sendOtp(email)
    if (data.testMode && data.previewUrl) {
      setStatus(`OTP sent (test mode). Check console for preview URL: ${data.previewUrl}`)
    } else {
      setStatus('OTP sent successfully to your email!')
    }
  } catch (e) {
    setStatus('')
    setError(e.message)
  }
}

async function onVerifyOtp() {
  setError('')
  setStatus('Verifying OTP...')
  emitUserAction('Clicked Verify OTP', { email })
  setUserActions((prev) => [{ action: 'Clicked Verify OTP', email, _ts: Date.now() }, ...prev])
  try {
    const data = await verifyOtp(email, otp)
    const u = data.user
    const receivedToken = data.token
    
    setUser(u)
    setTokenState(receivedToken)
    localStorage.setItem('tbv_user', JSON.stringify(u))
    localStorage.setItem('tbv_token', receivedToken)
    setStatus('Verified. Welcome!')
    setOtp('')
  } catch (e) {
    setStatus('')
    setError(e.message)
  }
}

function logout() {
  setUser(null)
  setTokenState(null)
  localStorage.removeItem('tbv_user')
  localStorage.removeItem('tbv_token')
  emitUserAction('Logged out', {})
}

async function handleExport(format) {
  try {
    emitUserAction(`Export logs as ${format.toUpperCase()}`, {})
    const response = await exportLogs({ 
      format, 
      limit: 1000, 
      action: filterAction || undefined 
    })
    
    // Create download link
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    
    const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`
    a.download = filename
    
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    setStatus(`Logs exported as ${format.toUpperCase()} successfully!`)
    setTimeout(() => setStatus(''), 3000)
  } catch (error) {
    setError(`Export failed: ${error.message}`)
  }
}

const actionsSet = useMemo(() => {
  const set = new Set(logs.map((l) => l.action).filter(Boolean))
  return Array.from(set).sort()
}, [logs])

return (
  <div className={`min-h-full ${themeClasses[theme]}`}>
    <div className="mx-auto max-w-7xl px-4 py-6">
      {isCheckingAuth ? (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="mb-4 text-2xl">🔐</div>
            <div className="text-lg font-medium">Checking Authentication...</div>
            <div className="mt-2 text-sm opacity-60">Verifying your session</div>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] opacity-50">Transparent Backend Visualizer</div>
              <div className="text-2xl font-semibold">OTP + Real-time Logs + Notifications</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="rounded-lg border border-opacity-20 bg-opacity-10 px-3 py-2 text-sm hover:bg-opacity-20 border bg"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? '🌙' : '☀️'}
              </button>
              {user ? (
                <>
                  <div className="rounded-lg border border-opacity-20 bg-opacity-10 px-3 py-2 text-sm border bg">
                    {user.email}
                  </div>
                  <button
                    onClick={logout}
                    className="rounded-lg border border-opacity-20 bg-opacity-10 px-3 py-2 text-sm hover:bg-opacity-20"
                  >
                    Logout
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {!user ? (
            <div className="mx-auto max-w-xl">
              <Panel title="Login (OTP)" tone="blue" right="Simulated email (console)">
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs opacity-60">Email</label>
                    <input
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${inputThemes[theme]}`}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onSendOtp}
                    className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
                  >
                    Send OTP
                  </button>
                  <div className="flex-1" />
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="mb-1 block text-xs opacity-60">OTP</label>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${inputThemes[theme]}`}
                    />
                  </div>
                  <button
                    onClick={onVerifyOtp}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400"
                  >
                    Verify OTP
                  </button>
                </div>

                {status ? <div className="text-sm text-white/70">{status}</div> : null}
                {error ? <div className="text-sm text-red-300">{error}</div> : null}
              </div>
            </Panel>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Panel title="User Actions" tone="blue" right={`${userActions.length} events`}>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    emitUserAction('Clicked Create Task (demo)', { userId: user.id })
                    setUserActions((prev) => [{ action: 'Clicked Create Task (demo)', _ts: Date.now() }, ...prev])
                  }}
                  className="w-full rounded-lg border border-blue-400/30 bg-blue-500/10 px-3 py-2 text-left text-sm hover:bg-blue-500/15"
                >
                  Create Task (demo action)
                </button>
                <div className="max-h-[60vh] space-y-2 overflow-auto pr-1">
                  {userActions.length === 0 ? (
                    <div className="text-sm text-white/60">Interact with the UI to see actions here.</div>
                  ) : (
                    userActions.map((a, idx) => (
                      <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <div className="text-sm font-medium">{a.action || a.actionName || 'Action'}</div>
                        <div className="mt-1 text-xs text-white/60">
                          {a.timestamp ? formatTs(a.timestamp) : a._ts ? formatTs(a._ts) : ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Panel>

            <Panel
              title="Backend Logs (real-time)"
              tone="yellow"
              right={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Filter</span>
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className={`rounded-md border px-2 py-1 text-xs ${theme === 'dark' ? 'bg-slate-900' : 'bg-white'}`}
                  >
                    <option value="">All</option>
                    {actionsSet.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleExport('json')}
                      className={`rounded-md border px-2 py-1 text-xs hover:opacity-80 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
                      title="Export as JSON"
                    >
                      📄 JSON
                    </button>
                    <button
                      onClick={() => handleExport('csv')}
                      className={`rounded-md border px-2 py-1 text-xs hover:opacity-80 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}
                      title="Export as CSV"
                    >
                      📊 CSV
                    </button>
                  </div>
                </div>
              }
            >
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search logs by action, message, or metadata..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none ${inputThemes[theme]}`}
                />
              </div>
              <div className="max-h-[70vh] overflow-auto pr-1">
                <div className="space-y-2">
                  {filteredLogs.map((l) => (
                    <div key={l._id || `${l.action}-${l.timestamp}-${l.message}`} className={`rounded-lg border p-3 ${theme === 'dark' ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className={`text-sm font-semibold ${theme === 'dark' ? 'text-yellow-200' : 'text-yellow-700'}`}>{l.action}</div>
                        <div className="text-xs opacity-50">{formatTs(l.timestamp)}</div>
                      </div>
                      <div className="mt-1 text-sm opacity-80">{l.message}</div>
                      {l.meta ? (
                        <pre className={`mt-2 overflow-auto rounded p-2 text-[11px] opacity-70 ${theme === 'dark' ? 'bg-black/30' : 'bg-slate-100'}`}>
                          {JSON.stringify(l.meta, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel title="Database / Activity Timeline" tone="green" right="last 7 days">
              <div className="space-y-4">
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-semibold">Daily activity</div>
                  <div className="mt-2 space-y-2">
                    {activity.length === 0 ? (
                      <div className="text-sm text-white/60">No activity yet.</div>
                    ) : (
                      activity.map((d) => (
                        <div key={d.date} className="flex items-center justify-between gap-3 text-sm">
                          <div className="text-white/80">{d.date}</div>
                          <div className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200">
                            {d.count} events
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="text-sm font-semibold">Notifications</div>
                  <div className="mt-2 max-h-64 space-y-2 overflow-auto pr-1">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-white/60">No notifications yet.</div>
                    ) : (
                      notifications.map((n) => (
                        <div key={n._id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                          <div className="text-sm">{n.message}</div>
                          <div className="mt-1 text-xs text-white/50">{formatTs(n.createdAt)}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
      </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}
