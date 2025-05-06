import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  const base = '/';
  
  return {
    plugins: [react()],
    base: base,
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: command === 'serve' ? 'inline' : false,
    },
    server: {
      port: 3000,
      open: true
    }
  }
})