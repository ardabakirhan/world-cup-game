import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


// base './' so the bundle works from Capacitor's local file server
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})


