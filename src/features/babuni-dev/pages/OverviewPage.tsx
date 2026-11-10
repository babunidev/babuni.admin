import { Link } from 'react-router-dom'
import { PageHeader } from '../../../shared/components/PageHeader'

// Static summary: this page reads nothing and changes nothing.
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
    text: 'Bring document changes from the other connected repositories to the website: pull, commit and push, then publish.',
  },
]

export function OverviewPage() {
  return (
    <div>
      <PageHeader
        title="Babuni Dev"
        description="Portfolio administration workspace for www.babuni.dev"
      />
      <ul className="grid max-w-4xl gap-4 sm:grid-cols-3">
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
      <section className="mt-6 max-w-4xl rounded-lg border border-gold/15 bg-slate/50 p-5">
        <h2 className="text-base font-medium text-gold-bright">Not available yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-fog">
          Documents are still edited and committed in their own repositories; there is no editor here yet.
          Comparing a single document with the live site before pulling, and pruning old releases on the
          server, are also still planned.
        </p>
      </section>
    </div>
  )
}
