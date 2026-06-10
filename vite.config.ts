import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        // ナビゲーションフォールバック（SPA用）の対象外にする設定を強化
        navigateFallbackDenylist: [/^\/api\//, /\/api/],
        
        // 【追加】Service Worker自体に、/api/ 以下の通信を完全に無視（スルー）させる設定
        runtimeCaching: [
          {
            urlPattern: /^\/api\/.*/,
            handler: 'NetworkOnly', // キャッシュを見ず、常にネットワークに直接取りに行かせる
          }
        ]
      },
      manifest: {
        name: 'FocusWeeks',
        short_name: 'FocusWeeks',
        description: 'マイFocusWeeksアプリケーション',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'FocusWeeksicon192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'FocusWeeksicon512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
