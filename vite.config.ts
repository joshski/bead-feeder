import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { DEV_PORTS } from './config/ports'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  root: '.',
  build: {
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
  server: {
    port: DEV_PORTS.VITE,
  },
})
