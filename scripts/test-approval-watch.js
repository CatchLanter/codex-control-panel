const {
  approvalData,
  approvalClear,
} = require('../dist/main/approval-watch.js')

const text = `
Would you like to run the following command?

  Environment: local

  Reason: test approval detection

  $ git ls-remote https://github.com/openai/skills.git HEAD

› 1. Yes, proceed (y)
  2. Yes, and don't ask again (p)
  3. No, and tell Codex what to do differently (esc)
`

const first = approvalData('unit-1', text)
const second = approvalData('unit-1', 'more output without the prompt')
const cleared = approvalClear('unit-1')
const afterClear = approvalData('unit-1', 'Would you like to run?')

const ok =
  first === true &&
  second === null &&
  cleared === true &&
  afterClear === true
console.log(ok ? 'APPROVAL WATCH PASS' : 'APPROVAL WATCH FAIL', {
  first,
  second,
  cleared,
  afterClear,
})
process.exit(ok ? 0 : 1)
