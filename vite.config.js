import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // When running locally, Vite serve can handle the SPA routing.
    // For local backend testing, use `npx vercel dev` which automatically
    // serves both the frontend and the /api functions.
  },
})
