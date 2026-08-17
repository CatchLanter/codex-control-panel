import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import {
  AddApiProviderOptions,
  CodexConfig,
  CodexConfigPatch,
  CodexInfo,
  DeleteConversationResult,
} from '../shared/types'

function run(file: string, args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      file,
      args,
      { timeout: timeoutMs, windowsHide: true },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(String(stdout).trim())
      },
    )
  })
}

function knownPath(): string | null {
  const candidate = path.join(
    process.env.LOCALAPPDATA || '',
    'Programs',
    'OpenAI',
    'Codex',
    'bin',
    'codex.exe',
  )
  return fs.existsSync(candidate) ? candidate : null
}

function configPath(): string {
  return path.join(os.homedir(), '.codex', 'config.toml')
}

function hasActiveWriterProcess(sessionId: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        'Get-CimInstance Win32_Process -Filter "Name = \'codex.exe\'" | Select-Object -ExpandProperty CommandLine',
      ],
      { timeout: 8000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          // If we cannot verify process state, be conservative and keep the lock.
          resolve(true)
          return
        }
        resolve(String(stdout).includes(sessionId))
      },
    )
  })
}

export async function releaseStaleWriterLock(
  sessionId: string,
): Promise<boolean> {
  const lockDir = path.join(os.homedir(), '.codex', 'thread-writer-locks')
  const lockFile = path.join(lockDir, `${sessionId}.lock`)
  if (!fs.existsSync(lockFile)) return false
  if (await hasActiveWriterProcess(sessionId)) return false
  try {
    fs.renameSync(lockFile, `${lockFile}.stale-${Date.now()}`)
    return true
  } catch {
    return false
  }
}

export async function hasActiveWriterLock(
  sessionId: string,
): Promise<boolean> {
  const lockDir = path.join(os.homedir(), '.codex', 'thread-writer-locks')
  const lockFile = path.join(lockDir, `${sessionId}.lock`)
  if (!fs.existsSync(lockFile)) return false
  return hasActiveWriterProcess(sessionId)
}

export function killWriterProcesses(sessionId: string): Promise<number> {
  return new Promise((resolve) => {
    const script = [
      '$p = Get-CimInstance Win32_Process -Filter "Name = \'codex.exe\'" | Where-Object { $_.CommandLine -like "*' +
        sessionId +
        '*" }',
      '$p | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }',
      '($p | Measure-Object).Count',
    ].join('; ')
    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', script],
      { timeout: 15000, windowsHide: true },
      (error, stdout) => {
        if (error) {
          resolve(0)
          return
        }
        const count = Number.parseInt(String(stdout).trim(), 10)
        resolve(Number.isFinite(count) ? count : 0)
      },
    )
  })
}

function modelsCatalogPath(configText: string): string | null {
  const match = configText.match(
    /^\s*model_catalog_json\s*=\s*"([^"]+)"/m,
  )
  if (match) return match[1].replace(/\\/g, '/')
  const fallback = path.join(os.homedir(), '.codex', 'models.json')
  return fs.existsSync(fallback) ? fallback : null
}

export async function detectCodex(): Promise<CodexInfo> {
  let executable = knownPath()
  let version: string | null = null

  if (!executable) {
    try {
      const found = (await run('where.exe', ['codex'])).split(/\r?\n/)[0]
      if (found && found.toLowerCase().endsWith('.exe')) executable = found
    } catch {
      // not on PATH
    }
  }

  if (executable) {
    try {
      version = await run(executable, ['--version'])
    } catch {
      // keep null
    }
  }

  const target = configPath()
  let model: string | null = null
  try {
    const text = fs.readFileSync(target, 'utf8')
    const match = text.match(/^\s*model\s*=\s*"([^"]+)"/m)
    if (match) model = match[1]
  } catch {
    // no config file
  }

  return {
    installed: Boolean(executable),
    path: executable,
    version,
    model,
    configPath: fs.existsSync(target) ? target : null,
  }
}

export function currentModelProvider(): {
  defaultProvider: string | null
  defined: string[]
} {
  try {
    const text = fs.readFileSync(configPath(), 'utf8')
    const defaultMatch = text.match(/^\s*model_provider\s*=\s*"([^"]+)"/m)
    const defined = [
      ...text.matchAll(/^\s*\[model_providers\.([^\]]+)\]\s*$/gm),
    ].map((match) => match[1])
    return {
      defaultProvider: defaultMatch?.[1] ?? null,
      defined,
    }
  } catch {
    return { defaultProvider: null, defined: [] }
  }
}

export async function deleteCodexConversation(
  id: string,
): Promise<DeleteConversationResult> {
  const info = await detectCodex()
  if (!info.path) {
    return { ok: false, output: '未检测到 Codex CLI' }
  }
  try {
    const output = await run(info.path, ['delete', '--force', id], 60000)
    return { ok: true, output: output || '已删除' }
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error),
    }
  }
}

interface ProviderSection {
  name: string
  baseUrl: string
  wireApi: string
  hasKey: boolean
}

function parseProviderSections(text: string): ProviderSection[] {
  const sections: ProviderSection[] = []
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*\[model_providers\.([^\]]+)\]\s*$/)
    if (!match) continue
    const section: ProviderSection = {
      name: match[1],
      baseUrl: '',
      wireApi: 'responses',
      hasKey: false,
    }
    for (
      let cursor = index + 1;
      cursor < lines.length && !/^\s*\[/.test(lines[cursor]);
      cursor += 1
    ) {
      const line = lines[cursor]
      const baseMatch = line.match(/^\s*base_url\s*=\s*"([^"]+)"/)
      const wireMatch = line.match(/^\s*wire_api\s*=\s*"([^"]+)"/)
      const keyMatch = line.match(
        /^\s*(experimental_bearer_token|api_key)\s*=/,
      )
      if (baseMatch) section.baseUrl = baseMatch[1]
      if (wireMatch) section.wireApi = wireMatch[1]
      if (keyMatch) section.hasKey = true
    }
    sections.push(section)
  }
  return sections
}

export function readCodexConfig(): CodexConfig {
  const target = configPath()
  let provider: string | null = null
  let model: string | null = null
  let reasoningEffort: string | null = null
  let providers: ProviderSection[] = []
  let models: string[] = []

  try {
    const text = fs.readFileSync(target, 'utf8')
    provider = text.match(/^\s*model_provider\s*=\s*"([^"]+)"/m)?.[1] ?? null
    model = text.match(/^\s*model\s*=\s*"([^"]+)"/m)?.[1] ?? null
    reasoningEffort =
      text.match(/^\s*model_reasoning_effort\s*=\s*"([^"]+)"/m)?.[1] ?? null
    providers = parseProviderSections(text)

    const catalog = modelsCatalogPath(text)
    if (catalog && fs.existsSync(catalog)) {
      const catalogData = JSON.parse(fs.readFileSync(catalog, 'utf8')) as {
        models?: Array<{ slug?: string }>
      }
      models = (catalogData.models ?? [])
        .map((entry) => entry.slug)
        .filter((slug): slug is string => Boolean(slug))
    }
  } catch {
    // config may not exist
  }

  if (provider === 'deepseek') {
    for (const slug of ['deepseek-v4-flash', 'deepseek-v4-pro']) {
      if (!models.includes(slug)) models.unshift(slug)
    }
  }
  if (model && !models.includes(model)) models.push(model)

  return {
    provider,
    model,
    reasoningEffort,
    providers,
    models,
    configPath: fs.existsSync(target) ? target : null,
  }
}

function setTopLevelValue(
  text: string,
  key: string,
  value: string,
): string {
  const lines = text.split(/\r?\n/)
  const index = lines.findIndex((line) =>
    new RegExp(`^\\s*${key}\\s*=`).test(line),
  )
  const replacement = `${key} = "${value}"`
  if (index >= 0) {
    lines[index] = replacement
  } else {
    const firstSection = lines.findIndex((line) => /^\s*\[/.test(line))
    if (firstSection >= 0) lines.splice(firstSection, 0, replacement)
    else lines.push(replacement)
  }
  return lines.join('\n')
}

export function writeCodexConfig(patch: CodexConfigPatch): CodexConfig {
  const target = configPath()
  let text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
  try {
    fs.copyFileSync(target, `${target}.bak`)
  } catch {
    // no previous config to back up
  }
  if (patch.provider) text = setTopLevelValue(text, 'model_provider', patch.provider)
  if (patch.model) text = setTopLevelValue(text, 'model', patch.model)
  if (patch.reasoningEffort) {
    text = setTopLevelValue(
      text,
      'model_reasoning_effort',
      patch.reasoningEffort,
    )
  }
  fs.writeFileSync(target, text.endsWith('\n') ? text : `${text}\n`, 'utf8')
  return readCodexConfig()
}

export function addCodexProvider(opts: AddApiProviderOptions): CodexConfig {
  const target = configPath()
  const name = opts.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
  if (!name || !opts.baseUrl.trim()) {
    throw new Error('API 名称和 base_url 不能为空')
  }
  let text = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : ''
  try {
    fs.copyFileSync(target, `${target}.bak`)
  } catch {
    // no previous config
  }
  const lines = text.split(/\r?\n/)
  const sectionIndex = lines.findIndex((line) =>
    new RegExp(`^\\s*\\[model_providers\\.${name}\\]\\s*$`).test(line),
  )
  if (sectionIndex >= 0) {
    const end = lines.findIndex(
      (line, index) => index > sectionIndex && /^\s*\[/.test(line),
    )
    const removeUntil = end >= 0 ? end : lines.length
    lines.splice(sectionIndex + 1, removeUntil - sectionIndex - 1)
    lines.splice(
      sectionIndex + 1,
      0,
      `name = "${name}"`,
      `base_url = "${opts.baseUrl.trim()}"`,
      `wire_api = "${opts.wireApi?.trim() || 'responses'}"`,
    )
    if (opts.bearerToken?.trim()) {
      lines.splice(
        sectionIndex + 4,
        0,
        `experimental_bearer_token = "${opts.bearerToken.trim()}"`,
      )
    }
  } else {
    if (lines.length && lines[lines.length - 1].trim()) lines.push('')
    lines.push(`[model_providers.${name}]`)
    lines.push(`name = "${name}"`)
    lines.push(`base_url = "${opts.baseUrl.trim()}"`)
    lines.push(`wire_api = "${opts.wireApi?.trim() || 'responses'}"`)
    if (opts.bearerToken?.trim()) {
      lines.push(
        `experimental_bearer_token = "${opts.bearerToken.trim()}"`,
      )
    }
  }
  fs.writeFileSync(target, `${lines.join('\n')}\n`, 'utf8')
  return readCodexConfig()
}
