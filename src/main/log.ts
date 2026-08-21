import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

let logPath: string | null = null

export function initLogging(dataDir: string): string {
  const dir = path.join(dataDir, 'logs')
  fs.mkdirSync(dir, { recursive: true })
  logPath = path.join(dir, 'app.log')
  return logPath
}

export function getLogPath(): string | null {
  return logPath
}

export function writeLog(level: LogLevel, message: string): void {
  if (!logPath) return
  const line = `${new Date().toISOString()} [${level}] ${message}\n`
  try {
    fs.appendFileSync(logPath, line, 'utf8')
  } catch {
    // logging must never crash the app
  }
}
