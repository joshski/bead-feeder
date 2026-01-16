/**
 * Port configuration for dev and test servers.
 * Using separate ports allows running dev and e2e tests concurrently.
 */

export const DEV_PORTS = {
  VITE: 5173,
  API: 3001,
} as const

export const TEST_PORTS = {
  VITE: 5174,
  API: 3002,
} as const
