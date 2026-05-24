import { useQuery } from '@tanstack/react-query'
import { ConnectionBanner } from '../components/ConnectionBanner'
import { PageHeader } from '../components/PageHeader'
import {
  apiBaseUrl,
  apiPrefix,
  getApiDisplayLabel,
  useDevProxy,
  useMockData,
} from '../config/api'
import {
  gameDataBaseUrl,
  localAdminApiBase,
  useLocalContent,
  useLocalPostgres,
} from '../config/constants'
import { formatPlayersLoadError } from '../services/adminApi'

export function SettingsPage() {
  const dbHealth = useQuery({
    queryKey: ['dbHealth'],
    enabled: useLocalPostgres,
    queryFn: async () => {
      const response = await fetch(`${localAdminApiBase}/health`)
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? `Health check failed (${response.status})`)
      }
      return body
    },
    retry: 0,
    refetchInterval: 10_000,
  })

  const apiItems = [
    { label: 'Data source', value: getApiDisplayLabel() },
    {
      label: 'Players source',
      value: useLocalPostgres
        ? 'PostgreSQL (VITE_DATABASE_URL)'
        : useMockData
          ? 'Mock data'
          : 'VPS admin API',
    },
    {
      label: 'API base',
      value: apiBaseUrl || '(not set — using mock)',
    },
    { label: 'API prefix', value: apiPrefix },
    {
      label: 'Dev proxy',
      value: useDevProxy
        ? 'Enabled (/api → API_PROXY_TARGET in .env.local)'
        : 'Off (browser calls VPS directly)',
    },
    {
      label: 'Auth',
      value: useMockData
        ? 'N/A'
        : useDevProxy
          ? 'ADMIN_API_KEY via proxy (recommended)'
          : 'VITE_API_TOKEN or VPS session cookie',
    },
    {
      label: 'Content source',
      value: useLocalContent
        ? `Local disk (${import.meta.env.VITE_MORKAHJA_PUBLIC ?? 'MorkahjaWebApp/client/public'})`
        : gameDataBaseUrl || '(remote)',
    },
  ]

  const settingsSections = [
    {
      title: 'Appearance',
      items: [
        { label: 'Theme', value: 'Dark Fantasy (default)' },
        { label: 'Density', value: 'Comfortable' },
      ],
    },
    {
      title: 'Connection',
      items: apiItems,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Local admin console — configure VPS access in .env.local on this PC only."
      />
      <div className="max-w-2xl space-y-6">
        {useLocalPostgres && dbHealth.isError && (
          <ConnectionBanner
            {...formatPlayersLoadError(dbHealth.error)}
          />
        )}
        {useLocalPostgres && dbHealth.isSuccess && (
          <p className="rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-300/90">
            PostgreSQL connection is working.
          </p>
        )}
        {useLocalPostgres && (
          <section className="rounded-lg border border-gold/15 bg-slate/50 p-5">
            <h2 className="text-sm uppercase tracking-widest text-gold-bright">
              PostgreSQL (local dev)
            </h2>
            <p className="mt-3 text-sm text-fog">
              Real player accounts load only when an SSH tunnel forwards your VPS
              database to <code className="text-gold-bright">127.0.0.1:5433</code>.
              Keep that terminal open while <code className="text-gold-bright">npm run dev</code> runs.
            </p>
            <pre className="mt-3 overflow-x-auto rounded border border-gold/15 bg-void/60 p-3 text-xs text-gold-bright">
              ssh -L 5433:127.0.0.1:5432 morkahja@89.167.120.88
            </pre>
          </section>
        )}
        {settingsSections.map((section) => (
          <section
            key={section.title}
            className="rounded-lg border border-gold/15 bg-slate/50 p-5"
          >
            <h2 className="text-sm uppercase tracking-widest text-gold-bright">
              {section.title}
            </h2>
            <dl className="mt-4 space-y-3">
              {section.items.map((item) => (
                <div
                  key={item.label}
                  className="flex flex-col gap-1 border-b border-gold/5 pb-3 last:border-0 last:pb-0 sm:flex-row sm:justify-between"
                >
                  <dt className="text-sm text-fog">{item.label}</dt>
                  <dd className="text-sm text-parchment sm:max-w-[60%] sm:text-right">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="text-xs text-fog">
          Copy <code className="text-gold-bright">.env.example</code> to{' '}
          <code className="text-gold-bright">.env.local</code>. That file stays on
          your PC and is not committed. Prefer{' '}
          <code className="text-gold-bright">ADMIN_API_KEY</code> with the dev proxy
          instead of <code className="text-gold-bright">VITE_API_TOKEN</code> so secrets
          are not embedded in the app bundle.
        </p>
      </div>
    </div>
  )
}
