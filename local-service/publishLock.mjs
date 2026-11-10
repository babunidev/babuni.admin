// One lock for every operation that touches the babuni.dev checkout or the
// live `current` link: document publish, repository pull, snapshot commit and
// site publish must never overlap.
let holder = null

export const publishLockHolder = () => holder

export async function withPublishLock(name, task) {
  if (holder) throw new Error('PUBLISH_BUSY')
  holder = name
  try { return await task() } finally { holder = null }
}
