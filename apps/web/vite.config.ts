import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const sentryRelease =
  process.env.VITE_SENTRY_RELEASE ?? process.env.VITE_APP_VERSION;

const shouldUploadSourcemaps =
  !!process.env.SENTRY_AUTH_TOKEN &&
  !!process.env.SENTRY_ORG &&
  !!process.env.SENTRY_PROJECT &&
  !!sentryRelease;

const plugins = [react(), tailwindcss()];

if (shouldUploadSourcemaps) {
  plugins.push(
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: {
        name: sentryRelease,
      },
      sourcemaps: {
        assets: './dist/**',
      },
    }),
  );
}

export default defineConfig({
  plugins,
  build: {
    sourcemap: shouldUploadSourcemaps,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
