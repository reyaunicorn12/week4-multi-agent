import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'week4-multi-agent';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? `/${repoName}/` : '/',
});
