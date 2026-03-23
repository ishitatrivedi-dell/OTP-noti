import { useEffect, useMemo, useState } from 'react'
import Panel from './components/Panel'
import {
  fetchDailyActivity,
  fetchLogs,
  fetchNotifications,
  sendOtp,
  verifyOtp,
  getCurrentUser,
  setToken,
  removeToken,
  exportLogs,
  getAuthStatus
} from './lib/api'
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

  // ✅ Filter logs
  const filteredLogs = useMemo(() => {
    let filtered = logs

    if (filterAction) {
      filtered = filtered.filter((l) => l.action === filterAction)
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (l) =>
          l.action.toLowerCase().includes(query) ||
          l.message.toLowerCase().includes(query) ||
          (l.meta && JSON.stringify(l.meta).toLowerCase().includes(query))
      )
    }

    return filtered
  }, [logs, filterAction, searchQuery])

  // ✅ Actions set
  const actionsSet = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean))
    return Array.from(set).sort()
  }, [logs])

  // ✅ Auth check
  useEffect(() => {
    const validateAuth = async () => {
      setIsCheckingAuth(true)

      if (token && !user) {
        try {
          const data = await getCurrentUser()
          setUser(data.user)
          setToken(data.token)
          localStorage.setItem('tbv_user', JSON.stringify(data.user))
          localStorage.setItem('tbv_token', data.token)
        } catch {
          try {
            const authStatus = await getAuthStatus()
            if (authStatus.authenticated && authStatus.user) {
              setUser(authStatus.user)
              emitUserAction('Session Restored', { email: authStatus.user.email })
            } else {
              removeToken()
              setTokenState(null)
              localStorage.removeItem('tbv_user')
            }
          } catch {
            removeToken()
            setTokenState(null)
            localStorage.removeItem('tbv_user')
          }
        }
      } else if (!token && user) {
        setUser(null)
        localStorage.removeItem('tbv_user')
      }

      setIsCheckingAuth(false)
    }

    validateAuth()
  }, [token, user])

  // ✅ Socket
  useEffect(() => {
    const s = getSocket()

    const onLog = (log) =>
      setLogs((prev) => [log, ...prev].slice(0, 500))

    const onUserAction = (evt) =>
      setUserActions((prev) => [
        { ...evt, _ts: Date.now() },
        ...prev
      ].slice(0, 100))

    s.on('log-update', onLog)
    s.on('user-action', onUserAction)

    return () => {
      s.off('log-update', onLog)
      s.off('user-action', onUserAction)
    }
  }, [])

  // ✅ Initial data
  useEffect(() => {
    ;(async () => {
      try {
        const [{ logs: initialLogs }, daily] = await Promise.all([
          fetchLogs({ limit: 200 }),
          fetchDailyActivity({ days: 7 })
        ])

        setLogs(initialLogs)
        setActivity(daily.activity || [])
      } catch (e) {
        setError(e.message)
      }
    })()
  }, [])

  // ✅ Notifications
  useEffect(() => {
    if (!user?.id) return

    ;(async () => {
      try {
        const data = await fetchNotifications({ userId: user.id, limit: 20 })
        setNotifications(data.notifications || [])
      } catch {}
    })()
  }, [user?.id])

  // ✅ OTP
  async function onSendOtp() {
    setError('')
    setStatus('Sending OTP...')
    emitUserAction('Clicked Send OTP', { email })

    try {
      localStorage.setItem('tbv_email', email)
      const data = await sendOtp(email)

      setStatus(
        data.testMode && data.previewUrl
          ? `OTP sent (test mode): ${data.previewUrl}`
          : 'OTP sent successfully!'
      )
    } catch (e) {
      setStatus('')
      setError(e.message)
    }
  }

  async function onVerifyOtp() {
    setError('')
    setStatus('Verifying OTP...')

    try {
      const data = await verifyOtp(email, otp)

      setUser(data.user)
      setTokenState(data.token)

      localStorage.setItem('tbv_user', JSON.stringify(data.user))
      localStorage.setItem('tbv_token', data.token)

      setStatus('Verified!')
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
  }

  async function handleExport(format) {
    try {
      const response = await exportLogs({ format, limit: 1000 })

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `logs.${format}`
      a.click()

      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div className={`min-h-full ${themeClasses[theme]}`}>
      <div className="mx-auto max-w-7xl px-4 py-6">

        {isCheckingAuth ? (
          <div>Checking Authentication...</div>
        ) : !user ? (
          <Panel title="Login">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className={`w-full ${inputThemes[theme]}`}
            />

            <button onClick={onSendOtp}>Send OTP</button>

            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="OTP"
            />

            <button onClick={onVerifyOtp}>Verify OTP</button>

            {status && <div>{status}</div>}
            {error && <div>{error}</div>}
          </Panel>
        ) : (
          <div>
            <button onClick={logout}>Logout</button>

            <Panel title="Logs">
              {filteredLogs.map((l) => (
                <div key={l._id}>
                  {l.action} - {l.message}
                </div>
              ))}
            </Panel>
          </div>
        )}

      </div>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  )
}