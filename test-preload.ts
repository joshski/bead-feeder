/**
 * Test preload file for bun:test
 * Sets up happy-dom for DOM testing and extends expect with jest-dom matchers
 */

import { expect } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import * as matchers from '@testing-library/jest-dom/matchers'

// Register happy-dom globals (document, window, etc.)
GlobalRegistrator.register()

// Extend bun:test expect with jest-dom matchers
expect.extend(matchers)

// Mock ResizeObserver for React Flow tests
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Adding mock to global (happy-dom provides ResizeObserver but we override it)
globalThis.ResizeObserver = ResizeObserverMock
