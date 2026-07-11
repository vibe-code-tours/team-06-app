import { test, expect } from '@playwright/test'

test('root path redirects to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
})
