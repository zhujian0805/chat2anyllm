import { test, expect } from '@playwright/test';

test('homepage has title and working navigation', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/React App/);
  
  // Expect the welcome message to be visible
  await expect(page.locator('text=Welcome to Chat2AnyLLM')).toBeVisible();
  
  // Expect the input field to be present
  await expect(page.locator('textarea[placeholder="Type your message..."]')).toBeVisible();
});