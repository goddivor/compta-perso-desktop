import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  main: {
    // electron-updater est bundle dans le main (la config electron-builder
    // n'embarque pas tout node_modules dans le paquet final)
    plugins: [externalizeDepsPlugin({ exclude: ['electron-updater'] })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main/index.js')
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload/index.js')
        }
      }
    }
  },
  renderer: {
    root: __dirname,
    plugins: [react()],
    server: {
      port: 3005
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'index.html')
      }
    }
  }
})
