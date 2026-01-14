import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debug, error, info, logRequest, warn } from './logger'

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleLogSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('info', () => {
    it('logs info messages to console.log', () => {
      info('Test message')
      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleLogSpy.mock.calls[0][0]).toContain('INFO')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('Test message')
    })
  })

  describe('warn', () => {
    it('logs warning messages to console.warn', () => {
      warn('Warning message')
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('WARN')
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('Warning message')
    })
  })

  describe('error', () => {
    it('logs error messages to console.error', () => {
      error('Error message')
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR')
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error message')
    })

    it('includes error details in output', () => {
      error('Request failed', { error: 'Connection timeout' })
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Connection timeout')
    })
  })

  describe('debug', () => {
    it('respects LOG_LEVEL environment variable', () => {
      // Default LOG_LEVEL is 'info', so debug should not log
      debug('Debug message')
      expect(consoleLogSpy).not.toHaveBeenCalled()
    })
  })

  describe('logRequest', () => {
    it('logs successful requests (2xx) as info', () => {
      logRequest('GET', '/api/issues', 200, 50)
      expect(consoleLogSpy).toHaveBeenCalled()
      expect(consoleLogSpy.mock.calls[0][0]).toContain('INFO')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('GET /api/issues')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('200')
      expect(consoleLogSpy.mock.calls[0][0]).toContain('50ms')
    })

    it('logs client errors (4xx) as warnings', () => {
      logRequest('POST', '/api/issues', 400, 10)
      expect(consoleWarnSpy).toHaveBeenCalled()
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('WARN')
      expect(consoleWarnSpy.mock.calls[0][0]).toContain('400')
    })

    it('logs server errors (5xx) as errors', () => {
      logRequest('GET', '/api/graph', 500, 100)
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('ERROR')
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('500')
    })
  })
})
