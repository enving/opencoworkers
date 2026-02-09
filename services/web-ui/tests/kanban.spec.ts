import { test, expect } from '@playwright/test';
import { mockTasks } from './fixtures/mock-data';

test.describe('Kanban Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({ json: mockTasks });
    });

    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        json: {
          status: 'running',
          lastPoll: null,
          activeSessions: 0,
          recentErrors: [],
          uptime: 3600,
          version: '1.0.0'
        }
      });
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

  test('should load app and display Kanban board', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'OpenCoworkers' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Backlog' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'In Progress' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible();

    await expect(page.getByText('TASK-001').first()).toBeVisible();
    await expect(page.getByText('Implement login feature').first()).toBeVisible();
  });

  test('should display tasks in correct swimlanes', async ({ page }) => {
    const backlogColumn = page.locator('[data-column-id="backlog"]');
    await expect(backlogColumn.getByText('TASK-001')).toBeVisible();

    const inProgressColumn = page.locator('[data-column-id="in_progress"]');
    await expect(inProgressColumn.getByText('TASK-002')).toBeVisible();

    const doneColumn = page.locator('[data-column-id="done"]');
    await expect(doneColumn.getByText('TASK-003')).toBeVisible();
  });

  test('should display priority badges', async ({ page }) => {
    await expect(page.getByText('high').first()).toBeVisible();
    await expect(page.getByText('medium').first()).toBeVisible();
    await expect(page.getByText('low').first()).toBeVisible();
  });

  test('should display status badges', async ({ page }) => {
    await expect(page.getByText('pending').first()).toBeVisible();
    await expect(page.getByText('in progress').first()).toBeVisible();
    await expect(page.getByText('completed').first()).toBeVisible();
  });
});
