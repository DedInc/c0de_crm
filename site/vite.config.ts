import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		allowedHosts: ['localhost', '.ngrok-free.app', '.ngrok.io']
	},
	test: {
		exclude: ['node_modules/**', 'tests/e2e/**'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov'],
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/routes/**/$types.*'],
			thresholds: {
				lines: 1,
				functions: 0.5,
				branches: 1,
				statements: 1
			}
		}
	}
});
