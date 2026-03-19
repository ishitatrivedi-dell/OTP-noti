import { useEffect, useMemo, useState } from 'react'
import Panel from './components/Panel'
import { fetchDailyActivity, fetchLogs, fetchNotifications, sendOtp, verifyOtp } from './lib/api'
import { emitUserAction, getSocket } from './lib/socket'

function formatTs(ts) {
  try {
    return new Date(ts).toLocaleTimeString()
  } catch {
    return ''
  }
}

export default function App() {
  const [email, setEmail] = useState(localStorage.getItem('tbv_email') || '')
  const [otp, setOtp] = useState('')
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('tbv_user')
    return raw ? JSON.parse(raw) : null
  })

  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const [userActions, setUserActions] = useState([])
  const [logs, setLogs] = useState([])
  const [filterAction, setFilterAction] = useState('')
  const [activity, setActivity] = useState([])
  const [notifications, setNotifications] = useState([])

  const filteredLogs = useMemo(() => {
    if (!filterAction) return logs
    return logs.filter((l) => l.action === filterAction)
  }, [logs, filterAction])

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
      setUser(u)
      localStorage.setItem('tbv_user', JSON.stringify(u))
      setStatus('Verified. Welcome!')
      setOtp('')
    } catch (e) {
      setStatus('')
      setError(e.message)
    }
  }

  function logout() {
    setUser(null)
    localStorage.removeItem('tbv_user')
    emitUserAction('Logged out', {})
  }

  const actionsSet = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean))
    return Array.from(set).sort()
  }, [logs])

  return (
    <div className="min-h-full bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Transparent Backend Visualizer</div>
            <div className="text-2xl font-semibold">OTP + Real-time Logs + Notifications</div>
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  {user.email}
                </div>
                <button
                  onClick={logout}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
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
                  <label className="mb-1 block text-xs text-white/60">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-400/60"
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
                    <label className="mb-1 block text-xs text-white/60">OTP</label>
                    <input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="6-digit OTP"
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-blue-400/60"
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
                    className="rounded-md border border-white/10 bg-slate-900 px-2 py-1 text-xs"
                  >
                    <option value="">All</option>
                    {actionsSet.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              }
            >
              <div className="max-h-[70vh] overflow-auto pr-1">
                <div className="space-y-2">
                  {filteredLogs.map((l) => (
                    <div key={l._id || `${l.action}-${l.timestamp}-${l.message}`} className="rounded-lg border border-white/10 bg-white/5 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-yellow-200">{l.action}</div>
                        <div className="text-xs text-white/50">{formatTs(l.timestamp)}</div>
                      </div>
                      <div className="mt-1 text-sm text-white/80">{l.message}</div>
                      {l.meta ? (
                        <pre className="mt-2 overflow-auto rounded bg-black/30 p-2 text-[11px] text-white/70">
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
  )
}
