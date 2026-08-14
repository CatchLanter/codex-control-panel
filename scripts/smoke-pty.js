const fs = require('fs')
const os = require('os')
const path = require('path')
const { TerminalManager } = require('../dist/main/terminal-manager.js')

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccp-smoke-'))
let output = ''
let finished = false

const manager = new TerminalManager(tempDir, {
  onData: (_id, data) => {
    output += data
  },
  onExit: (_id, exitCode) => {
    if (finished) return
    finished = true
    const ok = output.includes('CCP-SMOKE-OK')
    console.log(ok ? 'SMOKE PASS' : 'SMOKE FAIL', `exit=${exitCode}`)
    manager.closeAll(false)
    fs.rmSync(tempDir, { recursive: true, force: true })
    process.exit(ok ? 0 : 1)
  },
})

const meta = manager.create({
  shell: 'cmd',
  cwd: os.homedir(),
  cols: 80,
  rows: 24,
})

manager.write(meta.id, 'echo CCP-SMOKE-OK & exit\r')

setTimeout(() => {
  if (finished) return
  finished = true
  console.log('SMOKE TIMEOUT')
  manager.closeAll(false)
  fs.rmSync(tempDir, { recursive: true, force: true })
  process.exit(2)
}, 15000)
