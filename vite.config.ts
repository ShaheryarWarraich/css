import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './', // works from any GitHub Pages sub-path
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,json}'], maximumFileSizeToCacheInBytes: 5_000_000 },
      manifest: {
        name: 'CSS OS',
        short_name: 'CSS OS',
        description: "Evidence recall and argument-building trainer for Pakistan's CSS exam.",
        theme_color: '#0f5132',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})
