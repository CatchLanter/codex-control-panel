const buffers = new Map<string, string>()
const waiters = new Map<string, boolean>()

const APPROVAL_PATTERN =
  /(would you like to|waiting for approval|approve this|confirm this)/i

function clean(data: string): string {
  return data
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, ' ')
    .replace(/\x1b\][^\x07]*\x07/g, ' ')
}

export function approvalData(
  sessionId: string,
  data: string,
): boolean | null {
  const combined = ((buffers.get(sessionId) ?? '') + data).slice(-4000)
  buffers.set(sessionId, combined)
  const waiting = APPROVAL_PATTERN.test(clean(combined))
  if (waiters.get(sessionId) !== waiting) {
    waiters.set(sessionId, waiting)
    return waiting
  }
  return null
}

export function approvalClear(sessionId: string): boolean {
  if (waiters.get(sessionId) === true) {
    waiters.set(sessionId, false)
    buffers.set(sessionId, '')
    return true
  }
  return false
}
