import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis', // global 변수를 globalThis로 설정 - 채팅 사용
  },
  server: {
    proxy: {
      // 백엔드 context-path(/workly) 포함
      '/workly/ws-stomp': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        ws: true,    // WebSocket 업그레이드 요청도 함께 프록시
      },
      // API 호출도 동일하게
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
