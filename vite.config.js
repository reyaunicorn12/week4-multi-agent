import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var repoName = 'week4-multi-agent';
export default defineConfig({
    plugins: [react()],
    base: process.env.GITHUB_ACTIONS ? "/".concat(repoName, "/") : '/',
});
