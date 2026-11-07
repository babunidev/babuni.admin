import { spawn } from 'node:child_process'

// Fixed, server-owned Phase 2 scope. A profile name or target never extends access.
export const PORTFOLIO_GITHUB_REPO = 'babunidev/babuni.dev'
export const PORTFOLIO_LIVE_HOST = 'www.babuni.dev'

function result(state, code, detail, previous = {}) {
  const checkedAt = new Date().toISOString()
  return {
    state, code, detail, checkedAt,
    ...(state === 'available'
      ? { lastSuccessAt: checkedAt }
      : previous.lastSuccessAt ? { lastSuccessAt: previous.lastSuccessAt } : {}),
  }
}

/**
 * Use the operator's existing GitHub CLI login. No tokens are copied into
 * browser state, the profile registry, process arguments or this repository.
 * The command is a fixed read-only metadata request, never a shell string.
 */
export async function readPortfolioGithubMetadata() {
  return await new Promise((resolve, reject) => {
    const child = spawn('gh', [
      'api', '--hostname', 'github.com', 'repos/' + PORTFOLIO_GITHUB_REPO,
    ], { shell: false, stdio: ['ignore', 'pipe', 'ignore'] })
    let output = ''
    let finished = false
    const complete = (error, value) => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(value)
    }
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      complete(new Error('GITHUB_TIMEOUT'))
    }, 10000)
    child.stdout.on('data', chunk => {
      if (finished) return
      if (Buffer.byteLength(output) + chunk.length > 131072) {
        child.kill('SIGKILL')
        complete(new Error('GITHUB_RESPONSE_TOO_LARGE'))
        return
      }
      output += chunk.toString('utf8')
    })
    child.on('error', () => complete(new Error('GITHUB_CLI_UNAVAILABLE')))
    child.on('close', (code, signal) => {
      if (finished) return
      if (code !== 0 || signal) return complete(new Error('GITHUB_AUTH_OR_ACCESS_FAILED'))
      try { complete(null, JSON.parse(output)) }
      catch { complete(new Error('GITHUB_INVALID_RESPONSE')) }
    })
  })
}

/** A public HTTPS availability check; not an SSH or publishing connection. */
export async function checkPortfolioWebsiteHttps() {
  const response = await fetch('https://' + PORTFOLIO_LIVE_HOST + '/', {
    method: 'HEAD',
    redirect: 'manual',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  return {
    status: response.status,
    contentType: response.headers.get('content-type') || '',
  }
}

/**
 * The test action is an explicit manual outbound read. Neither adapter gains
 * edit, deploy, SSH, repository enumeration or arbitrary URL capabilities.
 */
export async function probeBabuniDevConnection(profile, previous = {}, dependencies = {}) {
  if (profile.projectId !== 'babuni-dev') {
    return result('error', 'PORTFOLIO_SCOPE_DENIED', 'Profile does not belong to Babuni Dev.', previous)
  }
  if (profile.kind === 'github') {
    if (profile.target !== PORTFOLIO_GITHUB_REPO) {
      return result('error', 'PORTFOLIO_TARGET_DENIED',
        'Only the approved Babuni Dev source repository is available for this initial check.', previous)
    }
    try {
      const metadata = await (dependencies.githubLookup || readPortfolioGithubMetadata)()
      if (metadata?.full_name !== PORTFOLIO_GITHUB_REPO ||
          typeof metadata.default_branch !== 'string' ||
          !/^[A-Za-z0-9._/-]{1,100}$/.test(metadata.default_branch)) {
        return result('error', 'GITHUB_INVALID_RESPONSE', 'GitHub returned unexpected repository metadata.', previous)
      }
      return result('available', 'GITHUB_READ_VERIFIED',
        'Authenticated GitHub CLI read confirmed for ' + metadata.full_name +
        ' (branch ' + metadata.default_branch + '). No editing permission was tested or granted.', previous)
    } catch (error) {
      const code = error instanceof Error && [
        'GITHUB_TIMEOUT', 'GITHUB_RESPONSE_TOO_LARGE', 'GITHUB_CLI_UNAVAILABLE',
        'GITHUB_AUTH_OR_ACCESS_FAILED', 'GITHUB_INVALID_RESPONSE',
      ].includes(error.message) ? error.message : 'GITHUB_READ_FAILED'
      return result('error', code, 'Authenticated GitHub metadata read failed. No repository change attempted.', previous)
    }
  }
  if (profile.kind === 'remote-publish') {
    if (profile.target !== PORTFOLIO_LIVE_HOST) {
      return result('error', 'PORTFOLIO_TARGET_DENIED',
        'Only the canonical Babuni Dev website is approved for this initial check.', previous)
    }
    try {
      const website = await (dependencies.websiteLookup || checkPortfolioWebsiteHttps)()
      if (website?.status !== 200 || !/text\/html/i.test(website.contentType || '')) {
        return result('error', 'WEBSITE_UNEXPECTED_RESPONSE',
          'The canonical HTTPS website did not return an HTML 200 response.', previous)
      }
      return result('available', 'WEBSITE_HTTPS_AVAILABLE',
        'Canonical website responded over HTTPS (HTML 200). This does not verify deployed revision or authorize SSH/publishing.', previous)
    } catch {
      return result('error', 'WEBSITE_UNREACHABLE', 'Canonical HTTPS website check failed; no publishing attempted.', previous)
    }
  }
  return result('error', 'PORTFOLIO_SCOPE_DENIED', 'Unsupported Babuni Dev connection type.', previous)
}
