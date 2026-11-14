import { randomBytes } from 'node:crypto'

// Environment for the local service and Vite started by `npm run dev`.
// Morkahja moderation is always on for the operator's own launcher (creative
// decision, 2026-11-14). An explicit BABUNI_MORKAHJA_REMOTE_MODERATION value in
// the calling shell still wins, e.g. `=disabled` for a session without it. The
// service keeps its own gate check, so other ways of starting it stay closed.
export function launcherEnv(base, servicePort, uiPort) {
  return {
    ...base,
    BABUNI_MORKAHJA_REMOTE_MODERATION: base.BABUNI_MORKAHJA_REMOTE_MODERATION ?? 'enabled',
    BABUNI_LOCAL_SERVICE_PORT: String(servicePort),
    BABUNI_UI_PORT: String(uiPort),
    BABUNI_LOCAL_SERVICE_TOKEN: randomBytes(32).toString('hex'),
    BABUNI_UI_SESSION_TOKEN: randomBytes(32).toString('hex'),
  }
}
