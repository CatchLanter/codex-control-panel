const os = require('os')
const { spawnSync } = require('child_process')
const { PtyClient } = require('../dist/main/pty-client.js')

process.env.CODEX_PANEL_NODE = process.execPath

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function processExists(imageName) {
  const result = spawnSync('tasklist.exe', [
    '/FI',
    `IMAGENAME eq ${imageName}`,
    '/FO',
    'CSV',
    '/NH',
  ])
  return /\.exe/i.test(String(result.stdout))
}

async function main() {
  let output = ''
  let exitResolve
  const exited = new Promise((resolve) => {
    exitResolve = resolve
  })

  const client = new PtyClient((event, payload) => {
    if (event === 'data') output += String(payload.data)
    if (event === 'exit') exitResolve(Number(payload.exitCode))
  })

  await client.start()

  const meta = await client.create({
    shell: 'cmd',
    cwd: os.homedir(),
    cols: 100,
    rows: 30,
  })
  client.write(meta.id, 'echo E2E-DAEMON-OK & exit\r')
  const code = await exited
  if (!output.includes('E2E-DAEMON-OK') || code !== 0) {
    console.error('E2E FAIL: terminal round-trip failed', `exit=${code}`)
    process.exit(1)
  }

  const childMeta = await client.create({
    shell: 'cmd',
    cwd: os.homedir(),
    cols: 100,
    rows: 30,
  })
  client.write(childMeta.id, 'timeout /t 120 /nobreak >nul\r')
  await sleep(3000)
  await client.kill(childMeta.id)
  await sleep(2000)
  if (processExists('timeout.exe')) {
    console.error('E2E FAIL: child process survived session kill')
    process.exit(1)
  }

  console.log('E2E PASS: terminal round-trip + process-tree cleanup')
  client.shutdown()
  process.exit(0)
}

main().catch((error) => {
  console.error('E2E FAIL', error)
  process.exit(1)
})

setTimeout(() => {
  console.error('E2E TIMEOUT')
  process.exit(2)
}, 30000)
