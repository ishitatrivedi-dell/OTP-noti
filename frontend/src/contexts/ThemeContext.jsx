import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('tbv_theme')
    return saved || 'dark'
  })

  useEffect(() => {
    localStorage.setItem('tbv_theme', theme)
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  const themeClasses = {
    dark: 'bg-slate-950 text-slate-100',
    light: 'bg-white text-slate-900'
  }

  const panelThemes = {
    dark: {
      blue: 'border-blue-500/40 bg-blue-500/5',
      yellow: 'border-yellow-500/40 bg-yellow-500/5',
      green: 'border-green-500/40 bg-green-500/5',
      neutral: 'border-white/10 bg-white/5',
    },
    light: {
      blue: 'border-blue-500/60 bg-blue-50',
      yellow: 'border-yellow-500/60 bg-yellow-50',
      green: 'border-green-500/60 bg-green-50',
      neutral: 'border-slate-200 bg-slate-50',
    }
  }

  const inputThemes = {
    dark: 'border-white/10 bg-white/5 text-white placeholder-white/50 focus:border-blue-400/60',
    light: 'border-slate-300 bg-white text-slate-900 placeholder-slate-500 focus:border-blue-400'
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      themeClasses,
      panelThemes,
      inputThemes
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
