// @ts-check
const { test, expect } = require('@playwright/test');

test('example test', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // Expect an attribute "to be strictly equal" to the value.
  await expect(page.locator('text=Get Started')).toHaveAttribute('href', '/docs/intro');

  // Click the get started link
  await page.locator('text=Get Started').click();
  // Expect some text to be visible on the page.
  await expect(page.locator('text=Installation')).toBeVisible();
});