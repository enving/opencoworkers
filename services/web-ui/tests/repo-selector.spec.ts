import { test, expect } from '@playwright/test';
import { mockTasks } from './fixtures/mock-data';

const mockRepos = {
  repos: [
    { id: 'KAN', name: 'KAN', path: '/repos/kanban', description: 'Kanban App' },
    { id: 'INFRA', name: 'INFRA', path: '/repos/infra', description: 'Infrastructure' }
  ],
  count: 2
};

const mockTasksWithRepos = {
  tasks: [
    { ...mockTasks.tasks[0], repository: 'KAN' },
    { ...mockTasks.tasks[1], repository: 'INFRA' },
    { ...mockTasks.tasks[2], repository: 'KAN' }
  ]
};

test.describe('Repository Selector', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/repos', async (route) => {
      await route.fulfill({ json: mockRepos });
    });

    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({ json: mockTasksWithRepos });
    });

    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        json: {
          status: 'running',
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

  test('should display repository selector with multi-repo config', async ({ page }) => {
    await expect(page.getByLabel('Repository:')).toBeVisible();
    await expect(page.locator('#repo-selector')).toBeVisible();
  });

  test('should show all repositories in dropdown', async ({ page }) => {
    const selector = page.locator('#repo-selector');
    await expect(selector).toBeVisible();
    
    const options = await selector.locator('option').allTextContents();
    expect(options.some(o => o.includes('All Repositories'))).toBe(true);
    expect(options.some(o => o.includes('KAN'))).toBe(true);
    expect(options.some(o => o.includes('INFRA'))).toBe(true);
  });

  test('should filter tasks by selected repository', async ({ page }) => {
    const selector = page.locator('#repo-selector');
    
    await expect(page.getByText('TASK-001').first()).toBeVisible();
    await expect(page.getByText('TASK-002').first()).toBeVisible();
    
    await selector.selectOption('KAN');
    
    await page.waitForTimeout(500);
    
    await expect(page.getByText('TASK-001').first()).toBeVisible();
    await expect(page.getByText('TASK-003').first()).toBeVisible();
  });

  test('should persist repository selection in localStorage', async ({ page }) => {
    const selector = page.locator('#repo-selector');
    
    await selector.selectOption('INFRA');
    
    const storedValue = await page.evaluate(() => localStorage.getItem('selectedRepoId'));
    expect(storedValue).toBe('INFRA');
    
    await page.reload();
    
    const selectorAfterReload = page.locator('#repo-selector');
    await expect(selectorAfterReload).toHaveValue('INFRA');
  });

  test('should show all tasks when "All Repositories" is selected', async ({ page }) => {
    const selector = page.locator('#repo-selector');
    
    await selector.selectOption('KAN');
    await page.waitForTimeout(500);
    
    await selector.selectOption('all');
    await page.waitForTimeout(500);
    
    await expect(page.getByText('TASK-001').first()).toBeVisible();
    await expect(page.getByText('TASK-002').first()).toBeVisible();
    await expect(page.getByText('TASK-003').first()).toBeVisible();
  });

  test('should clear localStorage when "All Repositories" is selected', async ({ page }) => {
    const selector = page.locator('#repo-selector');
    
    await selector.selectOption('KAN');
    let storedValue = await page.evaluate(() => localStorage.getItem('selectedRepoId'));
    expect(storedValue).toBe('KAN');
    
    await selector.selectOption('all');
    storedValue = await page.evaluate(() => localStorage.getItem('selectedRepoId'));
    expect(storedValue).toBeNull();
  });
});

test.describe('Repository Selector - Single Repo', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/repos', async (route) => {
      await route.fulfill({
        json: {
          repos: [{ id: 'default', name: 'Default', path: process.cwd() }],
          count: 1
        }
      });
    });

    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({ json: mockTasks });
    });

    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        json: { status: 'running', uptime: 3600, version: '1.0.0' }
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

  test('should not display repository selector with single repo', async ({ page }) => {
    await expect(page.getByLabel('Repository:')).not.toBeVisible();
  });
});
