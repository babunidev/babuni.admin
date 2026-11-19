import { useEffect, useState } from 'react'
import { onLocalServicePresence, probeLocalService } from './localServicePresence'

export function LocalServiceBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let stopped = false
    const apply = (online: boolean) => {
      if (!stopped) setOffline(!online)
    }
    const probe = () => {
      void probeLocalService().then(apply)
    }
    probe()
    const timer = window.setInterval(probe, 5000)
    const unsubscribe = onLocalServicePresence(apply)
    const onWake = () => {
      if (document.visibilityState === 'visible') probe()
    }
    window.addEventListener('focus', probe)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      stopped = true
      window.clearInterval(timer)
      unsubscribe()
      window.removeEventListener('focus', probe)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [])

  if (!offline) return null

  return (
    <div role="alert" className="shrink-0 border-b border-black/50 bg-alarm px-4 py-3 text-center">
      <p className="text-base font-medium tracking-wide text-red-100">Babuni Admin is offline</p>
      <p className="mt-1 text-sm text-parchment/90">
        The terminal is closed, so this page cannot reach the local server. Start Babuni Admin again.
      </p>
    </div>
  )
}
