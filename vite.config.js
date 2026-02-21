// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';  // ← required for path.resolve

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // This fixes the exact import error by pointing directly to the file
      'cropperjs/dist/cropper.css': path.resolve(
        __dirname,
        'node_modules/cropperjs/dist/cropper.css'
      ),
    },
  },
  // Optional: If you have other issues later, you can add more
});