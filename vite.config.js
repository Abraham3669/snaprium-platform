// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'  // add this import

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This tells Vite exactly where to find the CSS file
      'cropperjs/dist/cropper.css': path.resolve(
        __dirname,
        'node_modules/cropperjs/dist/cropper.css'
      ),
    },
  },
})