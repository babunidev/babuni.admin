import { PageHeader } from '../../../shared/components/PageHeader'

export function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Babuni Dev"
        description="Portfolio administration workspace"
      />
      <section className="max-w-2xl rounded-lg border border-gold/15 bg-slate/50 p-6">
        <h2 className="text-base font-medium text-gold-bright">Workspace established</h2>
        <p className="mt-3 text-sm leading-relaxed text-fog">
          The content manager is planned, not available yet. GitHub editing,
          module publishing and AI-assisted administration will require a
          separate authenticated backend before they can be enabled.
        </p>
        <p className="mt-3 text-sm text-fog">
          No portfolio content or live website data is modified here.
        </p>
      </section>
    </div>
  )
}
