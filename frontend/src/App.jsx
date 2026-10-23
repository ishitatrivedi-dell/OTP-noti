import { useEffect, useMemo, useState } from 'react'
import {
  fetchHealth,
  fetchLogs,
  fetchNotifications,
  fetchOverviewMetrics,
  sendOtp,
  verifyOtp,
  removeToken,
  exportLogs
} from './lib/api'
import { emitUserAction, getSocket } from './lib/socket'
import { ThemeProvider } from './contexts/ThemeContext'

function formatTs(timestamp) {
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString()
}

function formatUptime(seconds = 0) {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return [days ? `${days}d` : null, `${hours}h`, `${minutes}m`].filter(Boolean).join(' ')
}

function getLogDetails(log) {
  const match = log.message?.match(/^([A-Z]+) (.*?) → ([0-9]{3})$/)
  return {
    method: log.meta?.method || match?.[1] || '—',
    endpoint: log.meta?.endpoint || match?.[2] || log.message || 'Unknown request',
    statusCode: Number(log.meta?.statusCode || match?.[3]) || null,
    duration: Number(log.meta?.ms) || 0,
  }
}

function redactSensitiveData(value) {
  if (Array.isArray(value)) return value.map(redactSensitiveData)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (/otp|password|token|authorization|email/i.test(key)) return [key, '[REDACTED]']
    return [key, redactSensitiveData(entry)]
  }))
}

function HealthBadge({ status }) {
  const styles = {
    healthy: 'border-emerald-300/15 bg-emerald-300/[0.07] text-emerald-200',
    degraded: 'border-amber-300/15 bg-amber-300/[0.07] text-amber-200',
    unavailable: 'border-rose-300/15 bg-rose-300/[0.07] text-rose-200',
    checking: 'border-slate-400/15 bg-slate-300/[0.05] text-slate-300',
    unknown: 'border-slate-400/15 bg-slate-300/[0.05] text-slate-400',
    unconfigured: 'border-slate-400/15 bg-slate-300/[0.05] text-slate-400',
  }
  const label = status || 'unknown'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${styles[label] || styles.unknown}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${label === 'healthy' ? 'bg-emerald-300' : label === 'degraded' ? 'bg-amber-300' : label === 'unavailable' ? 'bg-rose-300' : 'bg-slate-500'}`} />
      {label}
    </span>
  )
}

function AppContent() {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [user, setUser] = useState(null)
  const [token, setTokenState] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [logs, setLogs] = useState([])
  const [notifications, setNotifications] = useState([])
  const [metrics, setMetrics] = useState(null)
  const [health, setHealth] = useState(null)
  const [healthError, setHealthError] = useState('')
  const [socketStatus, setSocketStatus] = useState('checking')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterLevel, setFilterLevel] = useState('all')
  const [expandedLogIds, setExpandedLogIds] = useState(() => new Set())
  const [currentView, setCurrentView] = useState('dashboard')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return logs.filter((log) => {
      if (filterAction && log.action !== filterAction) return false
      const statusCode = getLogDetails(log).statusCode
      if (filterLevel === 'errors' && (!statusCode || statusCode < 400)) return false
      if (filterLevel === 'success' && (!statusCode || statusCode >= 400)) return false
      if (!query) return true
      return [log.action, log.message, JSON.stringify(redactSensitiveData(log.meta || {}))]
        .some((value) => String(value || '').toLowerCase().includes(query))
    })
  }, [logs, filterAction, filterLevel, searchQuery])

  const actions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  )

  const totalRecentActivity = metrics?.requests?.total ?? 0
  const unreadNotifications = notifications.filter((item) => !item.read).length
  const otpVerificationAttempts = (metrics?.otp?.verified || 0)
    + (metrics?.otp?.verificationFailures || 0)
    + (metrics?.otp?.expiredAttempts || 0)
  const otpVerificationRate = otpVerificationAttempts
    ? Math.round(((metrics?.otp?.verified || 0) / otpVerificationAttempts) * 100)
    : 0

  useEffect(() => {
    removeToken()
    localStorage.removeItem('tbv_user')
  }, [])

  useEffect(() => {
    const socket = getSocket()
    const onConnect = () => setSocketStatus('healthy')
    const onDisconnect = () => setSocketStatus('unavailable')
    const onConnectError = () => setSocketStatus('unavailable')
    const onLog = (log) => {
      setLogs((previous) => [log, ...previous.filter((item) => item._id !== log._id)].slice(0, 500))
    }
    const onNotification = (notification) => {
      if (notification.userId !== user?.id) return
      setNotifications((previous) => [notification, ...previous].slice(0, 20))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('log-update', onLog)
    socket.on('notification-update', onNotification)
    setSocketStatus(socket.connected ? 'healthy' : 'checking')
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('log-update', onLog)
      socket.off('notification-update', onNotification)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id || !token) return
    let active = true

    const refreshDashboard = async () => {
      const results = await Promise.allSettled([
        fetchLogs({ limit: 200 }),
        fetchOverviewMetrics({ days: 7 }),
        fetchNotifications({ userId: user.id, limit: 20 }),
      ])
      if (!active) return

      const [logResult, metricsResult, notificationResult] = results
      if (logResult.status === 'fulfilled') {
        setLogs((previous) => {
          const logsById = new Map(logResult.value.logs.map((log) => [log._id, log]))
          previous.forEach((log) => logsById.set(log._id, log))
          return [...logsById.values()]
            .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
            .slice(0, 500)
        })
      }
      if (metricsResult.status === 'fulfilled') setMetrics(metricsResult.value)
      if (notificationResult.status === 'fulfilled') {
        setNotifications(notificationResult.value.notifications || [])
      }
      const failures = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason.message)
      if (failures.length) setError(failures.join(' · '))
      else setError('')
      setIsLoadingData(false)

      try {
        const healthResult = await fetchHealth()
        if (!active) return
        setHealth(healthResult)
        setHealthError('')
      } catch (requestError) {
        if (!active) return
        setHealthError(requestError.message)
        setHealth({ status: 'unavailable', database: 'unknown', email: 'unknown' })
      }
    }

    refreshDashboard()
    const intervalId = window.setInterval(refreshDashboard, 30000)
    return () => {
      active = false
      window.clearInterval(intervalId)
    }
  }, [user?.id, token])

  async function onSendOtp() {
    setError('')
    setStatus('Sending OTP...')
    setIsSendingOtp(true)
    emitUserAction('Clicked Send OTP')
    try {
      const data = await sendOtp(email)
      setStatus(data.testMode && data.previewUrl
        ? `Test email sent. Preview: ${data.previewUrl}`
        : data.message || 'OTP sent successfully.')
    } catch (requestError) {
      setStatus('')
      setError(requestError.message)
    } finally {
      setIsSendingOtp(false)
    }
  }

  async function onVerifyOtp() {
    setError('')
    setStatus('Verifying OTP...')
    setIsVerifyingOtp(true)
    try {
      const data = await verifyOtp(email, otp)
      setIsLoadingData(true)
      setUser(data.user)
      setTokenState(data.token)
      localStorage.setItem('tbv_user', JSON.stringify(data.user))
      localStorage.setItem('tbv_token', data.token)
      setCurrentView('dashboard')
      setOtp('')
      setStatus('Verified!')
    } catch (requestError) {
      setStatus('')
      setError(requestError.message)
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  function logout() {
    emitUserAction('User logged out', { email: user?.email })
    setUser(null)
    setTokenState(null)
    setCurrentView('dashboard')
    removeToken()
    localStorage.removeItem('tbv_user')
    setLogs([])
    setNotifications([])
  }

  function toggleLogDetails(id) {
    setExpandedLogIds((previous) => {
      const updated = new Set(previous)
      if (updated.has(id)) updated.delete(id)
      else updated.add(id)
      return updated
    })
  }

  async function handleExport(format) {
    setError('')
    try {
      const response = await exportLogs({ format, limit: 1000, action: filterAction || undefined })
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = `logs.${format}`
      link.click()
      URL.revokeObjectURL(url)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  if (!user) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080d19] px-4 py-10 text-slate-100">
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="pointer-events-none absolute -bottom-48 -right-24 h-[30rem] w-[30rem] rounded-full bg-cyan-500/10 blur-[140px]" />
        <main className="relative grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1424]/90 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:grid-cols-[0.9fr_1.1fr]">
          <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-600 via-indigo-600 to-[#182c57] p-10 md:flex">
            <div className="absolute -right-20 top-28 h-64 w-64 rounded-full border border-white/10" />
            <div className="absolute -right-10 top-40 h-44 w-44 rounded-full border border-white/10" />
            <div className="absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-cyan-300/10 blur-2xl" />
            <div className="relative flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-white/15 text-lg font-bold shadow-lg shadow-indigo-950/20">TB</span>
              <div>
                <p className="font-semibold tracking-wide">Traceboard</p>
                <p className="text-xs text-indigo-100/70">Backend observability</p>
              </div>
            </div>
            <div className="relative my-14">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-100/80">Your systems, in focus</p>
              <h1 className="max-w-sm text-4xl font-semibold leading-tight tracking-tight">See what your backend is doing.</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-indigo-100/75">
                Sign in to explore live server activity, recent events, and account notifications in one calm workspace.
              </p>
            </div>
            <div className="relative flex items-center gap-2 text-xs text-indigo-100/75">
              <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.8)]" />
              Secure email verification
            </div>
          </section>

          <section className="p-7 sm:p-10 md:p-12">
            <div className="mb-10 flex items-center gap-3 md:hidden">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold">TB</span>
              <div>
                <p className="font-semibold">Traceboard</p>
                <p className="text-xs text-slate-400">Backend observability</p>
              </div>
            </div>
            <div className="mb-8">
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/10 px-3 py-1.5 text-xs font-medium text-violet-200">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
                Secure sign in
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-white">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Enter your email and the one-time code we send you.</p>
            </div>

            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-300">Email address</label>
                <div className="flex items-center gap-3 rounded-xl border border-slate-700/80 bg-[#080e1b] px-4 transition focus-within:border-violet-400/70 focus-within:ring-4 focus-within:ring-violet-500/10">
                  <span aria-hidden="true" className="text-slate-500">✉</span>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
                  />
                </div>
              </div>
              <button
                onClick={onSendOtp}
                disabled={isSendingOtp || !email.trim()}
                className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-950/30 transition hover:from-violet-400 hover:to-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingOtp ? 'Sending code…' : 'Send verification code'}
                {!isSendingOtp && <span className="transition group-hover:translate-x-0.5">→</span>}
              </button>

              <div className="flex items-center gap-3 py-1">
                <span className="h-px flex-1 bg-slate-800" />
                <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-600">then verify</span>
                <span className="h-px flex-1 bg-slate-800" />
              </div>

              <div>
                <label htmlFor="otp" className="mb-2 block text-sm font-medium text-slate-300">6-digit verification code</label>
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-slate-700/80 bg-[#080e1b] px-4 py-3.5 text-center font-mono text-lg tracking-[0.5em] text-white outline-none transition placeholder:text-slate-700 focus:border-cyan-400/70 focus:ring-4 focus:ring-cyan-500/10"
                />
              </div>
              <button
                onClick={onVerifyOtp}
                disabled={isVerifyingOtp || otp.length !== 6 || !email.trim()}
                className="w-full rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3.5 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isVerifyingOtp ? 'Verifying…' : 'Verify and continue'}
              </button>
              {status && <p role="status" className="break-all rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">{status}</p>}
              {error && <p role="alert" className="break-all rounded-xl border border-rose-300/20 bg-rose-300/5 px-4 py-3 text-sm text-rose-200">{error}</p>}
            </div>
            <p className="mt-8 text-center text-xs text-slate-600">Your code expires after five minutes.</p>
          </section>
        </main>
      </div>
    )
  }

  const requestActivity = metrics?.requestActivity || []
  const maxRequests = Math.max(1, ...requestActivity.map((day) => day.requests))
  const maxErrorCount = Math.max(1, ...(metrics?.errorDistribution || []).map((item) => item.count))
  const requestMetrics = metrics?.requests || {}
  const apiStatus = healthError ? 'unavailable' : health ? 'healthy' : 'checking'

  return (
    <div className="min-h-screen bg-[#080d19] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-row items-center justify-between border-b border-white/[0.07] bg-[#0c1322] px-4 py-3 lg:w-64 lg:flex-col lg:items-stretch lg:justify-start lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex items-center gap-3 lg:mb-10">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold shadow-lg shadow-indigo-950/40">TB</span>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-wide">Traceboard</p>
              <p className="text-[11px] text-slate-500">Backend observability</p>
            </div>
          </div>
          <nav aria-label="Main navigation" className="flex items-center gap-2 lg:flex-col lg:items-stretch">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${currentView === 'dashboard' ? 'bg-violet-400/10 text-violet-200 ring-1 ring-violet-300/15' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}
            >
              <span className="text-base">◫</span><span className="hidden sm:inline">Overview</span>
            </button>
            <button
              onClick={() => setCurrentView('logs')}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${currentView === 'logs' ? 'bg-violet-400/10 text-violet-200 ring-1 ring-violet-300/15' : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'}`}
            >
              <span className="text-base">≡</span><span className="hidden sm:inline">Activity logs</span>
            </button>
          </nav>
          <div className="hidden lg:mt-auto lg:block">
            <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Signed in as</p>
              <p className="mt-1 truncate text-xs text-slate-300">{user.email}</p>
            </div>
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-400 transition hover:bg-rose-300/10 hover:text-rose-200"
            >
              <span>↪</span> Sign out
            </button>
          </div>
          <button
            onClick={logout}
            aria-label="Sign out"
            className="rounded-xl px-3 py-2 text-xs text-slate-400 transition hover:bg-rose-300/10 hover:text-rose-200 lg:hidden"
          >
            Sign out
          </button>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-300/80">Workspace / {currentView === 'dashboard' ? 'Overview' : 'Logs'}</p>
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">{currentView === 'dashboard' ? 'Backend overview' : 'Activity logs'}</h1>
              <p className="mt-1 text-sm text-slate-500">Monitor your application events and system activity.</p>
            </div>
            <div className="flex w-full items-center gap-3 sm:w-auto">
              <input
                aria-label="Search backend logs"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search logs"
                className="min-w-0 flex-1 rounded-xl border border-slate-700/60 bg-[#0d1424] px-4 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-400/50 focus:ring-4 focus:ring-violet-500/10 sm:w-56 sm:flex-none"
              />
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-teal-400 font-semibold text-[#09202a] ring-4 ring-cyan-300/10">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
          </header>

          {error && <p role="alert" className="mb-5 rounded-xl border border-rose-300/20 bg-rose-300/5 p-3 text-sm text-rose-200">{error}</p>}

          {currentView === 'dashboard' ? (
            <div className="space-y-6">
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  { label: 'API requests', value: requestMetrics.total ?? '—', detail: 'Last 7 days', icon: '↗', color: 'violet' },
                  { label: 'Successful requests', value: requestMetrics.successful ?? '—', detail: requestMetrics.total != null ? `${requestMetrics.total ? Math.round((requestMetrics.successful / requestMetrics.total) * 100) : 0}% success rate` : 'Waiting for metrics', icon: '✓', color: 'cyan' },
                  { label: 'Failed requests', value: requestMetrics.failed ?? '—', detail: requestMetrics.total != null ? `${requestMetrics.errorRate}% API error rate` : 'Waiting for metrics', icon: '!', color: 'rose' },
                  { label: 'Avg. response time', value: requestMetrics.total != null ? `${requestMetrics.avgResponseMs ?? 0} ms` : '—', detail: 'Across logged API requests', icon: '◷', color: 'amber' },
                  { label: 'Server uptime', value: health ? formatUptime(health.uptimeSeconds) : '—', detail: health?.checkedAt ? `Checked ${formatTs(health.checkedAt)}` : 'Waiting for health check', icon: '⌁', color: 'cyan' },
                  { label: 'OTP requests', value: metrics?.otp?.requested ?? '—', detail: `${metrics?.otp?.emailsSent ?? 0} sent · ${metrics?.otp?.emailFailures ?? 0} delivery failures`, icon: '✉', color: 'violet' }
                ].map((card) => (
                  <div key={card.label} className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 shadow-[0_10px_30px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:border-white/[0.12]">
                    <div className={`absolute -right-6 -top-8 h-28 w-28 rounded-full blur-3xl ${card.color === 'violet' ? 'bg-violet-500/10' : card.color === 'cyan' ? 'bg-cyan-400/10' : card.color === 'rose' ? 'bg-rose-400/10' : 'bg-amber-400/10'}`} />
                    <div className="relative flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-400">{card.label}</p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-white">{card.value}</p>
                      </div>
                      <span className={`flex h-10 w-10 items-center justify-center rounded-xl text-lg ${card.color === 'violet' ? 'bg-violet-400/10 text-violet-200' : card.color === 'cyan' ? 'bg-cyan-300/10 text-cyan-200' : card.color === 'rose' ? 'bg-rose-300/10 text-rose-200' : 'bg-amber-300/10 text-amber-200'}`}>{card.icon}</span>
                    </div>
                    <p className="relative mt-3 text-xs text-slate-600">{card.detail}</p>
                  </div>
                ))}
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.8fr)]">
                <div className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <h2 className="font-semibold text-slate-100">API performance</h2>
                      <p className="mt-1 text-xs text-slate-500">Request volume and average response time · 7 days</p>
                    </div>
                    <span className="rounded-full border border-cyan-300/10 bg-cyan-300/[0.06] px-3 py-1.5 text-xs font-medium text-cyan-100/80">{totalRecentActivity} requests</span>
                  </div>
                  {requestActivity.length ? (
                    <div className="flex h-48 items-end gap-2 border-b border-slate-800/70 pb-0">
                      {requestActivity.map((day) => (
                        <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                          <span className="text-[11px] font-medium text-slate-500">{day.requests}</span>
                          <div
                            title={`${day.date}: ${day.requests} requests · ${Math.round(day.avgResponseMs || 0)} ms average`}
                            className="w-full max-w-12 rounded-t-lg bg-gradient-to-t from-violet-500 to-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.08)] transition-opacity hover:opacity-80"
                            style={{ height: `${Math.max(4, (day.requests / maxRequests) * 100)}%` }}
                          />
                          <div className="mb-2 text-center">
                            <span className="block truncate text-[10px] text-slate-500">{day.date.slice(5)}</span>
                            <span className="mt-0.5 block text-[9px] text-cyan-200/50">{Math.round(day.avgResponseMs || 0)}ms</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-slate-500">
                      {isLoadingData ? 'Loading request metrics...' : 'No API request data available yet.'}
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-slate-100">Error distribution</h2>
                      <p className="mt-1 text-xs text-slate-500">Failed requests grouped by status code</p>
                    </div>
                  </div>
                  {metrics?.errorDistribution?.length ? (
                    <div className="space-y-4">
                      {metrics.errorDistribution.map((item) => (
                        <div key={item.statusCode}>
                          <div className="mb-1.5 flex justify-between text-xs">
                            <span className="font-mono text-rose-200">{item.statusCode}</span>
                            <span className="text-slate-500">{item.count} requests</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                            <div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-orange-300" style={{ width: `${(item.count / maxErrorCount) * 100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="py-8 text-center text-sm text-slate-500">
                      {isLoadingData ? 'Loading errors...' : 'No failed API responses in this period.'}
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
                <div className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                  <div className="mb-4">
                    <h2 className="font-semibold text-slate-100">Most-used endpoints</h2>
                    <p className="mt-1 text-xs text-slate-500">Top routes by request count this week</p>
                  </div>
                  {metrics?.topEndpoints?.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[500px] text-left text-xs">
                        <thead className="text-[10px] uppercase tracking-wider text-slate-600">
                          <tr><th className="pb-3 font-medium">Endpoint</th><th className="pb-3 font-medium">Requests</th><th className="pb-3 font-medium">Errors</th><th className="pb-3 font-medium">Avg. time</th></tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {metrics.topEndpoints.map((endpoint) => (
                            <tr key={`${endpoint.method}-${endpoint.endpoint}`}>
                              <td className="py-3 pr-4 font-mono text-slate-300"><span className="mr-2 text-violet-300">{endpoint.method}</span>{endpoint.endpoint}</td>
                              <td className="py-3 text-slate-400">{endpoint.requests}</td>
                              <td className={`py-3 ${endpoint.failures ? 'text-rose-300' : 'text-slate-500'}`}>{endpoint.failures}</td>
                              <td className="py-3 text-slate-400">{endpoint.avgResponseMs} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="py-8 text-center text-sm text-slate-500">{isLoadingData ? 'Loading endpoints...' : 'No endpoint data available.'}</p>}
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                  <div className="mb-4">
                    <h2 className="font-semibold text-slate-100">OTP & notifications</h2>
                    <p className="mt-1 text-xs text-slate-500">Authentication delivery and verification events</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ['OTP requests', metrics?.otp?.requested],
                      ['Emails sent', metrics?.otp?.emailsSent],
                      ['Delivery failures', metrics?.otp?.emailFailures],
                      ['Verified', metrics?.otp?.verified],
                      ['Invalid attempts', metrics?.otp?.verificationFailures],
                      ['Expired attempts', metrics?.otp?.expiredAttempts],
                      ['Pending OTPs', metrics?.otp?.pending],
                      ['Notifications', metrics?.otp?.notificationsCreated],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/[0.05] bg-[#0a1120]/70 p-3">
                        <p className="text-[11px] text-slate-500">{label}</p>
                        <p className={`mt-1 text-lg font-semibold ${label.includes('failure') || label.includes('attempt') ? 'text-rose-200' : 'text-slate-100'}`}>{value ?? '—'}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-300/[0.08] bg-cyan-300/[0.03] px-3 py-2.5">
                    <span className="text-xs text-slate-400">Verification success rate</span>
                    <span className="text-sm font-semibold text-cyan-200">{otpVerificationAttempts ? `${otpVerificationRate}%` : '—'}</span>
                  </div>
                  <p className="mt-3 text-[10px] leading-4 text-slate-600">OTP values, passwords, and email addresses are excluded from monitoring details.</p>
                  <div className="mt-5 border-t border-white/[0.06] pt-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-300">Recent notifications</p>
                      <span className="text-[10px] text-slate-600">{unreadNotifications} unread</span>
                    </div>
                    {notifications.length ? (
                      <ul className="space-y-2">
                        {notifications.slice(0, 3).map((notification) => (
                          <li key={notification._id} className="flex items-start justify-between gap-3 text-xs">
                            <span className="text-slate-400">{notification.message}</span>
                            <time className="shrink-0 text-[10px] text-slate-600">{formatTs(notification.createdAt)}</time>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-xs text-slate-600">No notifications received.</p>}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-slate-100">System health</h2>
                    <p className="mt-1 text-xs text-slate-500">{health?.checkedAt ? `Last checked ${formatTs(health.checkedAt)}` : 'Waiting for health checks'}</p>
                  </div>
                  <HealthBadge status={apiStatus} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Backend API', apiStatus],
                    ['MongoDB', health?.database || 'checking'],
                    ['Email service', health?.email || 'checking'],
                    ['Socket.IO', socketStatus],
                  ].map(([label, serviceStatus]) => (
                    <div key={label} className="flex items-center justify-between rounded-xl border border-white/[0.05] bg-[#0a1120]/70 px-4 py-3">
                      <span className="text-sm text-slate-300">{label}</span>
                      <HealthBadge status={serviceStatus} />
                    </div>
                  ))}
                </div>
                {healthError && <p className="mt-3 text-xs text-rose-300">{healthError}</p>}
              </section>

              <section className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-100">Recent backend logs</h2>
                    <p className="mt-1 text-xs text-slate-500">Live server events, persisted in MongoDB</p>
                  </div>
                  <button onClick={() => setCurrentView('logs')} className="rounded-lg px-3 py-2 text-xs font-medium text-violet-200 transition hover:bg-violet-300/10">
                    View all logs
                  </button>
                </div>
                <LogList
                  logs={logs.filter((log) => log.action === 'API').slice(0, 8)}
                  isLoading={isLoadingData}
                  expandedLogIds={expandedLogIds}
                  onToggle={toggleLogDetails}
                />
              </section>
            </div>
          ) : (
            <section className="rounded-2xl border border-white/[0.07] bg-[#0e1626] p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-100">Server log history</h2>
                  <p className="mt-1 text-xs text-slate-500">Persisted backend events with filtering and export</p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <select
                    aria-label="Filter logs by response level"
                    value={filterLevel}
                    onChange={(event) => setFilterLevel(event.target.value)}
                    className="rounded-lg border border-slate-700/70 bg-[#0a1120] px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/50"
                  >
                    <option value="all">All levels</option>
                    <option value="errors">API errors</option>
                    <option value="success">Successful API</option>
                  </select>
                  <select
                    aria-label="Filter logs by action"
                    value={filterAction}
                    onChange={(event) => setFilterAction(event.target.value)}
                    className="min-w-32 rounded-lg border border-slate-700/70 bg-[#0a1120] px-3 py-2 text-xs text-slate-200 outline-none focus:border-violet-400/50"
                  >
                    <option value="">All actions</option>
                    {actions.map((action) => <option key={action} value={action}>{action}</option>)}
                  </select>
                  <button onClick={() => handleExport('json')} className="rounded-lg border border-slate-700/70 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-violet-300/30 hover:bg-violet-300/10 hover:text-violet-100">
                    Export JSON
                  </button>
                  <button onClick={() => handleExport('csv')} className="rounded-lg border border-slate-700/70 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/10 hover:text-cyan-100">
                    Export CSV
                  </button>
                </div>
              </div>
              <LogList
                logs={filteredLogs}
                isLoading={isLoadingData}
                expandedLogIds={expandedLogIds}
                onToggle={toggleLogDetails}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  )
}

function LogList({ logs, isLoading, expandedLogIds, onToggle }) {
  if (!logs.length) {
    return <p className="py-10 text-center text-sm text-slate-500">{isLoading ? 'Loading server logs...' : 'No server logs match this view.'}</p>
  }

  return (
    <div className="max-h-[560px] space-y-3 overflow-y-auto">
      {logs.map((log) => (
        <article key={log._id} className="rounded-xl border border-white/[0.06] bg-[#0a1120]/70 p-4 transition hover:border-violet-300/15 hover:bg-[#10192b]">
          {(() => {
            const details = getLogDetails(log)
            const isExpanded = expandedLogIds.has(log._id)
            const isApiRequest = log.action === 'API'
            return (
              <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isApiRequest ? (
                <>
                  <span className="rounded-md border border-violet-300/10 bg-violet-300/[0.07] px-2 py-1 text-[11px] font-medium text-violet-200">{details.method}</span>
                  <code className="max-w-[min(60vw,520px)] truncate font-mono text-xs text-slate-300">{details.endpoint}</code>
                  <span className={`rounded-md px-2 py-1 font-mono text-[11px] ${details.statusCode >= 500 ? 'bg-rose-400/10 text-rose-200' : details.statusCode >= 400 ? 'bg-amber-300/10 text-amber-200' : 'bg-emerald-300/10 text-emerald-200'}`}>{details.statusCode ?? '—'}</span>
                </>
              ) : <span className="rounded-md border border-violet-300/10 bg-violet-300/[0.07] px-2 py-1 text-[11px] font-medium text-violet-200">{log.action}</span>}
              {log.userId && <span className="text-xs text-slate-500">User {log.userId}</span>}
            </div>
            <div className="flex items-center gap-3">
              {isApiRequest && <span className="text-xs text-slate-500">{details.duration} ms</span>}
              <time className="text-xs text-slate-600">{formatTs(log.timestamp)}</time>
            </div>
          </div>
          {!isApiRequest && <p className="mt-2 text-sm leading-6 text-slate-300">{log.message}</p>}
          {log.meta && Object.keys(log.meta).length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => onToggle(log._id)}
                className="text-xs font-medium text-violet-300 hover:text-violet-200"
              >
                {isExpanded ? 'Hide metadata' : 'Inspect metadata'}
              </button>
              {isExpanded && (
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-white/[0.04] bg-[#070b14] p-3 text-xs leading-5 text-cyan-100/60">
                  {JSON.stringify(redactSensitiveData(log.meta), null, 2)}
                </pre>
              )}
            </div>
          )}
              </>
            )
          })()}
        </article>
      ))}
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
