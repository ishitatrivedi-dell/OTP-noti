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
    dark: 'bg-black text-white font-sf',
    light: 'bg-black text-white font-sf'
  }

  const panelThemes = {
    dark: {
      blue: 'bg-neutral-900 text-white border border-white/10',
      yellow: 'bg-neutral-900 text-white border border-white/10',
      green: 'bg-neutral-900 text-white border border-white/10',
      neutral: 'bg-neutral-900 text-white border border-white/10',
    },
    light: {
      blue: 'bg-neutral-900 text-white border border-white/10',
      yellow: 'bg-neutral-900 text-white border border-white/10',
      green: 'bg-neutral-900 text-white border border-white/10',
      neutral: 'bg-neutral-900 text-white border border-white/10',
    }
  }

  const inputThemes = {
    dark: 'bg-neutral-900 text-white placeholder-white/40 focus:border-white/30 rounded-xl border border-white/10',
    light: 'bg-neutral-900 text-white placeholder-white/40 focus:border-white/30 rounded-xl border border-white/10'
  }

  const buttonThemes = {
    dark: 'bg-white text-black hover:bg-gray-200',
    light: 'bg-black text-white hover:bg-gray-800'
  }

  const secondaryButtonThemes = {
    dark: 'bg-neutral-800 text-white hover:bg-neutral-700',
    light: 'bg-neutral-200 text-black hover:bg-neutral-300'
  }

  const borderClasses = {
    dark: 'border-white/10',
    light: 'border-black/10'
  }

  const cardThemes = {
    dark: 'bg-[#111111] border-white/10',
    light: 'bg-[#f9f9f9] border-black/10'
  }

  return (
    <ThemeContext.Provider value={{
      theme,
      toggleTheme,
      themeClasses,
      panelThemes,
      inputThemes,
      buttonThemes,
      secondaryButtonThemes,
      borderClasses,
      cardThemes
    }}>
      {children}
    </ThemeContext.Provider>
  )
}
