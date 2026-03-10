import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      external: ['marked', 'XLSX'],
      output: {
        globals: {
          marked: 'marked',
          XLSX: 'XLSX',
        },
        inlineDynamicImports: true,
      },
    },
  },
})
