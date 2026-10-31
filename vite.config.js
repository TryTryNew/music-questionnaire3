import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 用相對路徑，GitHub Pages（網址在 /music-questionnaire/ 底下）和 Vercel 都能正常運作
  base: './',
});
