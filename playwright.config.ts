import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: 0,
    webServer: {
        command: 'npm run dev --workspace=apps/web',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },
})
