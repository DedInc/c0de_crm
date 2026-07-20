import { defineConfig, devices } from '@playwright/test';

const startServer = process.env.PLAYWRIGHT_START_SERVER === 'true';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
		trace: 'on-first-retry'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: startServer
		? {
				command: 'pnpm run build && pnpm run preview -- --host 127.0.0.1',
				url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:4173',
				reuseExistingServer: !process.env.CI,
				timeout: 120_000
			}
		: undefined
});
