const http = require('http')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch (error) {
            reject(error)
          }
        })
      })
      .on('error', reject)
  })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  const targets = await getJson('http://127.0.0.1:9222/json/list')
  const page = targets.find((target) => target.type === 'page')
  if (!page) throw new Error('no page target')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = reject
  })

  let seq = 1
  const pending = new Map()
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  }
  const call = (method, params) =>
    new Promise((resolve) => {
      const id = seq++
      pending.set(id, resolve)
      ws.send(JSON.stringify({ id, method, params }))
    })

  await call('Runtime.enable', {})
  const created = await call('Runtime.evaluate', {
    expression: `(async () => {
      const meta = await window.api.sessions.runCommand({
        shell: 'cmd',
        cwd: 'C:\\\\Users\\\\27920',
        command: 'codex --no-alt-screen',
        permissions: { mode: 'default', customApproval: 'on-request', customSandbox: 'workspace-write', customBypass: false },
        codexSession: true,
      })
      return meta.id
    })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  console.log('created session:', created.result?.result?.value)

  await sleep(12000)
  await call('Runtime.evaluate', {
    expression: `window.api.window.toggleMaximize(); 'toggled'`,
    returnByValue: true,
  })
  console.log('maximize toggled')
  await sleep(6000)

  const viewport = await call('Runtime.evaluate', {
    expression: `JSON.stringify({ inner: [window.innerWidth, window.innerHeight] })`,
    returnByValue: true,
  })
  console.log('viewport:', viewport.result?.result?.value)
  ws.close()
}

main().catch((error) => {
  console.error('CDP FAIL', error)
  process.exit(1)
})
