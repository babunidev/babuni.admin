import { Link } from 'react-router-dom'
import { PageHeader } from '../../../shared/components/PageHeader'
import { PublishPanel } from '../components/PublishPanel'
import { ReleaseCleanupPanel } from '../components/ReleaseCleanupPanel'

// The publish panel checks automatically on open; the tool cards are static links.
const tools = [
  {
    to: '/connections',
    title: 'Connection',
    text: 'Check GitHub access, the public website and the deployment SSH login for www.babuni.dev.',
  },
  {
    to: '/babuni-dev/documents',
    title: 'Documents',
    text: 'Publish one of the website’s own documents (README, CHANGELOG, docs/…) without a full rebuild.',
  },
  {
    to: '/babuni-dev/repositories',
    title: 'Repositories',
    text: 'The same publishing as above, one step at a time, or for a single repository.',
  },
]

export function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Babuni Dev"
        description="Portfolio administration workspace for www.babuni.dev"
      />
      <PublishPanel />
      <ul className="mt-6 grid max-w-4xl gap-4 sm:grid-cols-3">
        {tools.map(tool => (
          <li key={tool.to}>
            <Link to={tool.to}
              className="block h-full rounded-lg border border-gold/15 bg-slate/50 p-5 transition hover:border-gold/40">
              <h2 className="text-base font-medium text-gold-bright">{tool.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-fog">{tool.text}</p>
            </Link>
          </li>
        ))}
      </ul>
      <ReleaseCleanupPanel />
      <section className="mt-6 max-w-4xl rounded-lg border border-gold/15 bg-slate/50 p-5">
        <h2 className="text-base font-medium text-gold-bright">Not available yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          Documents are still edited and committed in their own repositories; there is no editor here yet.
        </p>
      </section>
    </div>
  )
}
