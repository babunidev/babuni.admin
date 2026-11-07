import { spawn } from 'node:child_process'
import { readMorkahjaModerationConfig } from './morkahjaModerationConfig.mjs'
import { buildContentSshArgs } from './morkahjaContentRunner.mjs'
import { lstat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

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


// The portfolio lives on the same VPS, but authentication is still checked
// through the existing operator-approved SSH identity and pinned host key.
// The endpoint accepts NO browser-provided host, directory, user or command.
const DEPLOY_USER = 'babunideploy'
const DEPLOY_KEY_NAME = 'id_ed25519_babuni_deploy'
const WEBSITE_ROOT_INSPECTOR = [
  'import json, os',
  'root = "/var/www/babuni.dev/current"',
  'usable = os.path.isdir(root) and os.access(root, os.R_OK | os.X_OK)',
  'index = os.path.join(root, "index.html")',
  'index_readable = os.path.isfile(index) and os.access(index, os.R_OK)',
  'releases = "/var/www/babuni.dev/releases"',
  'staging_writable = os.path.isdir(releases) and os.access(releases, os.W_OK | os.X_OK)',
  'print(json.dumps({"usable": bool(usable), "indexReadable": bool(index_readable), "stagingWritable": bool(staging_writable)}))',
].join('\n') + '\n'

function portfolioSshEnvironment(env = process.env) {
  const permitted = {}
  for (const name of ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'SSH_AUTH_SOCK', 'XDG_RUNTIME_DIR']) {
    if (typeof env[name] === 'string') permitted[name] = env[name]
  }
  permitted.SSH_ASKPASS_REQUIRE = 'never'
  permitted.SSH_ASKPASS = '/bin/false'
  return permitted
}

/** Short-lived, fixed-command SSH check. No upload, shell interpolation or password prompt. */
export async function checkPortfolioSshRoot(config, deps = {}) {
  return await new Promise(resolve => {
    const start = deps.spawnCommand || spawn
    const child = start('ssh', buildContentSshArgs(config), {
      shell: false, stdio: ['pipe', 'pipe', 'ignore'],
      env: portfolioSshEnvironment(),
    })
    let stdout = ''
    let done = false
    let limitExceeded = false
    let timedOut = false
    const finish = value => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
      finish({ ok: false, code: 'PORTFOLIO_SSH_TIMEOUT' })
    }, 12000)
    child.stdout?.on('data', chunk => {
      if (done || limitExceeded) return
      if (Buffer.byteLength(stdout) + chunk.length > 2048) {
        limitExceeded = true
        child.kill('SIGKILL')
        finish({ ok: false, code: 'PORTFOLIO_SSH_INVALID_RESPONSE' })
      } else stdout += chunk.toString('utf8')
    })
    child.on('error', () => finish({ ok: false, code: 'PORTFOLIO_SSH_UNAVAILABLE' }))
    child.on('close', (code, signal) => {
      if (done) return
      if (timedOut) return finish({ ok: false, code: 'PORTFOLIO_SSH_TIMEOUT' })
      if (code !== 0 || signal) return finish({ ok: false, code: 'PORTFOLIO_SSH_FAILED' })
      let parsed
      try { parsed = JSON.parse(stdout) }
      catch { return finish({ ok: false, code: 'PORTFOLIO_SSH_INVALID_RESPONSE' }) }
      if (typeof parsed?.usable !== 'boolean' || typeof parsed?.indexReadable !== 'boolean' ||
          typeof parsed?.stagingWritable !== 'boolean') {
        return finish({ ok: false, code: 'PORTFOLIO_SSH_INVALID_RESPONSE' })
      }
      return finish(!parsed.usable || !parsed.indexReadable
        ? { ok: false, code: 'PORTFOLIO_ROOT_UNREADABLE' }
        : parsed.stagingWritable
          ? { ok: true, code: 'PORTFOLIO_SSH_STAGING_VERIFIED' }
          : { ok: false, code: 'PORTFOLIO_STAGING_UNWRITABLE' })
    })
    child.stdin?.on('error', () => {})
    try { child.stdin?.end(WEBSITE_ROOT_INSPECTOR) }
    catch { child.kill('SIGKILL'); finish({ ok: false, code: 'PORTFOLIO_SSH_FAILED' }) }
  })
}

/** One Babuni Dev administrator backed by the existing host identity.
 *  GitHub and public HTTPS remain separate permissions; they do not confer SSH writes.
 */
export async function checkBabuniDevAdministrator(adminProfile, deps = {}) {
  const checkedAt = new Date().toISOString()
  if (!adminProfile || adminProfile.projectId !== 'morkahja' ||
      adminProfile.kind !== 'postgres-ssh-moderation') {
    return { ok: false, code: 'ADMIN_CONNECTION_MISSING', checkedAt }
  }
  const github = await probeBabuniDevConnection({
    projectId: 'babuni-dev', kind: 'github', target: PORTFOLIO_GITHUB_REPO,
  }, {}, deps)
  const website = await probeBabuniDevConnection({
    projectId: 'babuni-dev', kind: 'remote-publish', target: PORTFOLIO_LIVE_HOST,
  }, {}, deps)
  let ssh
  try {
    const authorized = await (deps.readConfig || readMorkahjaModerationConfig)(adminProfile)
    if (!authorized.ok) ssh = { ok: false, code: authorized.code }
    else {
      // The existing VPS host and pin are shared; the website uses its
      // pre-existing least-privileged deployment account and private key.
      const keyPath = join(homedir(), '.ssh', DEPLOY_KEY_NAME)
      const keyStatus = deps.keyStatus || (async () => {
        const stat = await lstat(keyPath)
        return stat.isFile() && !stat.isSymbolicLink() &&
          (typeof process.getuid !== 'function' || stat.uid === process.getuid()) &&
          (stat.mode & 0o077) === 0
      })
      if (!await keyStatus(keyPath)) ssh = { ok: false, code: 'PORTFOLIO_DEPLOY_KEY_UNAVAILABLE' }
      else ssh = await (deps.sshLookup || checkPortfolioSshRoot)({
        ...authorized.config, sshUser: DEPLOY_USER, sshIdentityFile: keyPath,
      })
    }
  } catch {
    ssh = { ok: false, code: 'PORTFOLIO_DEPLOY_KEY_UNAVAILABLE' }
  }
  const allGood = github.state === 'available' && website.state === 'available' && ssh.ok
  return {
    ok: allGood, code: allGood ? 'PORTFOLIO_READ_CONNECTION_READY' : 'PORTFOLIO_CONNECTION_PARTIAL',
    checkedAt, host: adminProfile.target,
    github: { ok: github.state === 'available', code: github.code },
    website: { ok: website.state === 'available', code: website.code },
    ssh: { ok: ssh.ok === true, code: ssh.code },
    // This result does not indicate a configured publishing service.
    publishingEnabled: false,
  }
}
