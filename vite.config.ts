import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      host: '0.0.0.0',
      port: 3000,

      // 기존 HMR 설정 유지
      hmr: process.env.DISABLE_HMR !== 'true',

      // 기존 파일 감시 설정 유지
      watch: process.env.DISABLE_HMR === 'true' ? null : {},

      // Cloudflare 임시 주소 허용 (개발용)
      allowedHosts: ['.trycloudflare.com'],

      // Python WebSocket 서버 연결
      proxy: {
        '/ws': {
          target: 'ws://127.0.0.1:8765',
          ws: true,
          rewrite: (path) => path.replace(/^\/ws/, ''),
        },
      },
    },
  };
});
