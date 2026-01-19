import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  method?: string
  path?: string
  status?: number
  durationMs?: number
  error?: string
}

const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
const IS_TEST = process.env.NODE_ENV === 'test'
const TEST_LOG_FILE = './temp/test.log'

// Initialize log file at module load if in test mode
if (IS_TEST) {
  const logDir = dirname(TEST_LOG_FILE)
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true })
  }
  // Clear the log file at the start of each test run
  writeFileSync(TEST_LOG_FILE, '')
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[LOG_LEVEL]
}

function formatLog(entry: LogEntry): string {
  const { timestamp, level, message, method, path, status, durationMs, error } =
    entry

  const parts = [
    `[${timestamp}]`,
    `[${level.toUpperCase().padEnd(5)}]`,
    message,
  ]

  if (method && path) {
    parts.push(`${method} ${path}`)
  }

  if (status !== undefined) {
    parts.push(`-> ${status}`)
  }

  if (durationMs !== undefined) {
    parts.push(`(${durationMs}ms)`)
  }

  if (error) {
    parts.push(`| Error: ${error}`)
  }

  return parts.join(' ')
}

function log(level: LogLevel, message: string, meta?: Partial<LogEntry>) {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  }

  const formatted = formatLog(entry)

  if (IS_TEST) {
    // In test mode, write to file instead of stdout
    appendFileSync(TEST_LOG_FILE, `${formatted}\n`)
  } else if (level === 'error') {
    console.error(formatted)
  } else if (level === 'warn') {
    console.warn(formatted)
  } else {
    console.log(formatted)
  }
}

export function debug(message: string, meta?: Partial<LogEntry>) {
  log('debug', message, meta)
}

export function info(message: string, meta?: Partial<LogEntry>) {
  log('info', message, meta)
}

export function warn(message: string, meta?: Partial<LogEntry>) {
  log('warn', message, meta)
}

export function error(message: string, meta?: Partial<LogEntry>) {
  log('error', message, meta)
}

export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  error?: string
) {
  const level: LogLevel =
    status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
  log(level, 'Request', { method, path, status, durationMs, error })
}

// Export for testing
export { TEST_LOG_FILE }

export type { LogLevel, LogEntry }
