import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { debug, error, info, logRequest, TEST_LOG_FILE, warn } from './logger'

describe('logger', () => {
  // Helper to read log file contents
  function getLogContent(): string {
    return readFileSync(TEST_LOG_FILE, 'utf-8')
  }

  // Clear log file before each test
  beforeEach(() => {
    writeFileSync(TEST_LOG_FILE, '')
  })

  afterEach(() => {
    writeFileSync(TEST_LOG_FILE, '')
  })

  describe('info', () => {
    it('logs info messages to file', () => {
      info('Test message')
      const content = getLogContent()
      expect(content).toContain('INFO')
      expect(content).toContain('Test message')
    })
  })

  describe('warn', () => {
    it('logs warning messages to file', () => {
      warn('Warning message')
      const content = getLogContent()
      expect(content).toContain('WARN')
      expect(content).toContain('Warning message')
    })
  })

  describe('error', () => {
    it('logs error messages to file', () => {
      error('Error message')
      const content = getLogContent()
      expect(content).toContain('ERROR')
      expect(content).toContain('Error message')
    })

    it('includes error details in output', () => {
      error('Request failed', { error: 'Connection timeout' })
      const content = getLogContent()
      expect(content).toContain('Connection timeout')
    })
  })

  describe('debug', () => {
    it('respects LOG_LEVEL environment variable', () => {
      // Default LOG_LEVEL is 'info', so debug should not log
      debug('Debug message')
      const content = getLogContent()
      expect(content).not.toContain('Debug message')
    })
  })

  describe('logRequest', () => {
    it('logs successful requests (2xx) as info', () => {
      logRequest('GET', '/api/issues', 200, 50)
      const content = getLogContent()
      expect(content).toContain('INFO')
      expect(content).toContain('GET /api/issues')
      expect(content).toContain('200')
      expect(content).toContain('50ms')
    })

    it('logs client errors (4xx) as warnings', () => {
      logRequest('POST', '/api/issues', 400, 10)
      const content = getLogContent()
      expect(content).toContain('WARN')
      expect(content).toContain('400')
    })

    it('logs server errors (5xx) as errors', () => {
      logRequest('GET', '/api/graph', 500, 100)
      const content = getLogContent()
      expect(content).toContain('ERROR')
      expect(content).toContain('500')
    })

    it('includes error message for 500 responses when provided', () => {
      logRequest('GET', '/api/graph', 500, 100, 'Failed to clone repository')
      const content = getLogContent()
      expect(content).toContain('ERROR')
      expect(content).toContain('500')
      expect(content).toContain('Error: Failed to clone repository')
    })

    it('does not include error section when error is undefined', () => {
      logRequest('GET', '/api/graph', 200, 50)
      const content = getLogContent()
      expect(content).not.toContain('Error:')
    })
  })
})
