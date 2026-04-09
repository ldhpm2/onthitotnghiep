import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11', 'iOS >= 12', 'Chrome >= 60'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime']
    })
  ],
  server: {
    // When running locally, Vite serve can handle the SPA routing.
    // For local backend testing, use `npx vercel dev` which automatically
    // serves both the frontend and the /api functions.
  },
})
