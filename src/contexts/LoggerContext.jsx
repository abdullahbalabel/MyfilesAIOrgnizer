import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const LoggerContext = createContext(null)

export function LoggerProvider({ children }) {
  const [logs, setLogs] = useState([])

  const addLog = useCallback((message, type = 'info', source = 'App') => {
    const entry = {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      message: String(message),
      type,   // 'info' | 'success' | 'error' | 'ai' | 'warn' | 'fs'
      source, // 'Gemini' | 'FileSystem' | 'App' | 'Electron'
    }
    setLogs((prev) => [...prev.slice(-499), entry]) // keep last 500
  }, [])

  const clearLogs = useCallback(() => setLogs([]), [])

  // Forward main-process logs from Electron IPC
  useEffect(() => {
    if (!window.electron?.onMainLog) return
    const unsub = window.electron.onMainLog((_event, msg) => {
      addLog(msg.message, msg.type || 'info', msg.source || 'Electron')
    })
    return () => unsub?.()
  }, [addLog])

  return (
    <LoggerContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </LoggerContext.Provider>
  )
}

export function useLogger() {
  const ctx = useContext(LoggerContext)
  if (!ctx) throw new Error('useLogger must be used inside LoggerProvider')
  return ctx
}
