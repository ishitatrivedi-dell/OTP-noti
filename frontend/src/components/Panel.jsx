export default function Panel({ title, tone = 'neutral', right, children }) {
  const tones = {
    blue: 'border-blue-500/40 bg-blue-500/5',
    yellow: 'border-yellow-500/40 bg-yellow-500/5',
    green: 'border-green-500/40 bg-green-500/5',
    neutral: 'border-white/10 bg-white/5',
  }

  return (
    <div className={`rounded-xl border ${tones[tone] || tones.neutral} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide text-white/90">{title}</div>
        {right ? <div className="text-xs text-white/60">{right}</div> : null}
      </div>
      {children}
    </div>
  )
}

