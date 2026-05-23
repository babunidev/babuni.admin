import { PageHeader } from '../components/PageHeader'

const settingsSections = [
  {
    title: 'Appearance',
    items: [
      { label: 'Theme', value: 'Dark Fantasy (default)' },
      { label: 'Density', value: 'Comfortable' },
    ],
  },
  {
    title: 'Notifications',
    items: [
      { label: 'Report alerts', value: 'Enabled (mock)' },
      { label: 'Critical logs', value: 'Enabled (mock)' },
    ],
  },
  {
    title: 'API',
    items: [
      { label: 'Backend', value: 'Not connected' },
      { label: 'Auth', value: 'Pending integration' },
    ],
  },
]

export function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Console preferences and integration placeholders."
      />
      <div className="space-y-6 max-w-2xl">
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
                  <dd className="text-sm text-parchment">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
        <p className="text-xs text-fog">
          No sensitive values are stored in the browser. Connect a backend to
          persist settings.
        </p>
      </div>
    </div>
  )
}
