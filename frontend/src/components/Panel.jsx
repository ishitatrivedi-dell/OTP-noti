import { useTheme } from '../contexts/ThemeContext'

export default function Panel({ title, tone = 'neutral', right, children }) {
  const { theme, panelThemes } = useTheme()
  
  return (
    <div className={`rounded-xl border ${panelThemes[theme][tone] || panelThemes[theme].neutral} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold tracking-wide opacity-90">{title}</div>
        {right ? <div className="text-xs opacity-60">{right}</div> : null}
      </div>
      {children}
    </div>
  )
}

