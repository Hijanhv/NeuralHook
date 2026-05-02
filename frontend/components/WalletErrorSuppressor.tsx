'use client'
import { useEffect } from 'react'

export default function WalletErrorSuppressor() {
  useEffect(() => {
    const orig = console.error.bind(console)
    console.error = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (
        msg.includes('User rejected') ||
        msg.includes('user rejected') ||
        msg.includes('4001') ||
        msg.includes('denied transaction') ||
        msg.includes('evmAsk')
      ) return
      orig(...args)
    }

    const suppress = (e: PromiseRejectionEvent) => {
      const reason = e.reason as { message?: string; code?: number } | undefined
      const msg = reason?.message ?? ''
      const code = reason?.code
      if (
        msg.includes('User rejected') ||
        msg.includes('user rejected') ||
        code === 4001
      ) e.preventDefault()
    }
    window.addEventListener('unhandledrejection', suppress)
    return () => {
      console.error = orig
      window.removeEventListener('unhandledrejection', suppress)
    }
  }, [])
  return null
}
