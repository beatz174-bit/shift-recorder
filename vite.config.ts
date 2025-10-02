import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'robots.txt', 'apple-touch-icon.svg'],
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}']
      },
      manifest: {
        name: 'Chrona',
        short_name: 'Chrona',
        description: 'Chrona keeps shift-based professionals on schedule with offline-first tracking.',
        theme_color: '#0f172a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: '/pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          },
          {
            src: '/pwa-icon-maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@app': '/src/app',
      '@tax-engine': '/packages/tax-engine/src',
      '@tax-engine/core': '/packages/tax-engine/src/core/index.ts'
    }
  },
  test: {
    environment: 'happy-dom',
    setupFiles: './vitest.setup.ts',
    exclude: [...configDefaults.exclude, 'src/tests/e2e/**/*'],
    coverage: {
      reporter: ['text', 'lcov']
    }
  }
});
