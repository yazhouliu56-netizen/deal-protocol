import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: ['**/node_modules/**', 'mobile/**', 'e2e/**', 'oto-spatial-web/**', 'src/base/**', 'src/ammo/**', 'src/lib/dial.test.ts', 'src/lib/scan.test.ts', 'src/lib/qr.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@base': path.resolve(__dirname, './src/base'),
      '@ammo': path.resolve(__dirname, './src/ammo'),
      '@/base': path.resolve(__dirname, './src/base'),
      '@/ammo': path.resolve(__dirname, './src/ammo'),
      '@/store': path.resolve(__dirname, './src/store'),
    },
  },
})
