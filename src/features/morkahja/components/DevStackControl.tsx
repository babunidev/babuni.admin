import { useEffect, useState } from 'react'
import { localConnectionApi } from '../../../shared/services/localConnectionClient'

// Start or restart the Morkahja game's local server and client on this PC.
// The local service runs fixed npm scripts in the game checkout; nothing about
// the command comes from the browser.
interface DevStackPart {
  id: string
  label: string
  port: number
  state: 'running' | 'stopped' | 'foreign'
}
interface DevStackStatus {
  state: 'running' | 'stopped' | 'partial'
  parts: DevStackPart[]
  logs: string
  ok?: boolean
}

const button = 'rounded border border-gold/40 px-3 py-2 text-sm text-gold-bright disabled:opacity-40'
const errors: Record<string, string> = {
  DEV_STACK_BUSY: 'A start or restart is already running.',
  GAME_CHECKOUT_UNAVAILABLE: 'The MorkahjaWebApp checkout was not found.',
  PORT_HELD_BY_OTHER_PROGRAM: 'Port 3000 or 5173 is used by a program outside the game checkout; it was left alone.',
  DEV_STACK_STATUS_FAILED: 'Could not read which local ports are in use.',
  LOCAL_SERVICE_UNAVAILABLE: 'The Babuni Admin local service is not reachable.',
}
const partText = (part: DevStackPart) =>
  `${part.label} :${part.port} ${part.state === 'running' ? 'running' : part.state === 'foreign' ? 'port used by another program' : 'stopped'}`

export function DevStackControl() {
  const [status, setStatus] = useState<DevStackStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    let mounted = true
    localConnectionApi<DevStackStatus>('GET', '/morkahja/dev-stack').then(result => {
      if (mounted) setStatus(result)
    }).catch(error => {
      const code = error instanceof Error ? error.message : ''
      if (mounted) setMessage(errors[code] || code || 'Status unavailable.')
    })
    return () => { mounted = false }
  }, [])

  async function restart() {
    setBusy(true)
    setMessage(status?.state === 'stopped' ? 'Starting backend and frontend…' : 'Restarting backend and frontend…')
    try {
      const result = await localConnectionApi<DevStackStatus>('POST', '/morkahja/dev-stack/restart', {})
      setStatus(result)
      setMessage(result.ok ? 'Backend and frontend are running.'
        : `Not everything came up within 30 seconds. Logs: ${result.logs}`)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      setMessage(errors[code] || code || 'Start failed.')
    } finally { setBusy(false) }
  }

  const running = status && status.state !== 'stopped'
  return <div className="flex flex-wrap items-center gap-3">
    <button type="button" className={button} disabled={busy || !status} onClick={() => void restart()}>
      {busy ? 'Working…' : running ? 'Restart backend and frontend' : 'Start backend and frontend'}
    </button>
    <span className="text-sm text-fog" role="status">
      {message || (status ? status.parts.map(partText).join(' · ') : 'Checking local game…')}
    </span>
  </div>
}
