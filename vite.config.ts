import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react' // Vueの場合は@vitejs/plugin-vue
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
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