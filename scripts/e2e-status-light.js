const http = require('http')

function getJson(url) {
  return new Promise((resolve, reject) => {
    http
      .get(url, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve(JSON.parse(data)))
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
  const evaluate = async (expression) => {
    const res = await call('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    return res.result?.result?.value
  }

  await call('Runtime.enable', {})
  const clicked = await evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find(
      (item) => item.textContent.includes('新建空终端'),
    )
    if (!button) return false
    button.click()
    return true
  })()`)
  console.log('clicked new terminal button:', clicked)
  await sleep(1800)
  const sessions = await evaluate(`window.api.sessions.list()`)
  const sessionId = Array.isArray(sessions) ? sessions[sessions.length - 1]?.id : undefined
  console.log('session:', sessionId)
  if (!sessionId) throw new Error('no session created')

  await evaluate(`window.api.sessions.write(${JSON.stringify(sessionId)}, 'echo Would you like to run the following command?\\r')`)
  await sleep(2000)
  const waitingCount = await evaluate(
    `document.querySelectorAll('.tab .status-light.waiting').length`,
  )
  console.log('waiting lights:', waitingCount)

  await evaluate(`window.api.sessions.write(${JSON.stringify(sessionId)}, 'x')`)
  await sleep(1200)
  const waitingAfter = await evaluate(
    `document.querySelectorAll('.tab .status-light.waiting').length`,
  )
  const activeAfter = await evaluate(
    `document.querySelectorAll('.tab .status-light.active').length`,
  )
  console.log('after answer -> waiting:', waitingAfter, 'active:', activeAfter)

  const ok = waitingCount >= 1 && waitingAfter === 0 && activeAfter >= 1
  console.log(ok ? 'STATUS LIGHT E2E PASS' : 'STATUS LIGHT E2E FAIL')
  ws.close()
  process.exit(ok ? 0 : 1)
}

main().catch((error) => {
  console.error('E2E FAIL', error)
  process.exit(1)
})
