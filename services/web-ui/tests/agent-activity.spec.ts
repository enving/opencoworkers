import { test, expect } from '@playwright/test';

test.describe('Agent Activity Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({ json: { tasks: [], meta: {} } });
    });

    await page.route('**/api/events', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: connected\ndata: {"timestamp":"2026-01-19T12:00:00.000Z"}\n\n'
      });
    });

    await page.goto('/');
  });

  test('should display Agent Activity Monitor', async ({ page }) => {
    await expect(page.getByText('Live Monitor')).toBeVisible();
  });

  test('should show events counter', async ({ page }) => {
    // The counter is in a badge next to the Live Monitor title
    const panel = page.locator('div', { has: page.getByText('Live Monitor') });
    await expect(panel.locator('span').filter({ hasText: /^0$/ })).toBeVisible();
  });

  test('should display waiting or connecting message', async ({ page }) => {
    const waitingMessage = page.getByText(/Standing by|Establishing encrypted stream/);
    await expect(waitingMessage).toBeVisible();
  });
});
