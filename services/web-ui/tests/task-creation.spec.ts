import { test, expect } from '@playwright/test';
import { mockTasks } from './fixtures/mock-data';

test.describe('Task Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        const newTask = {
          id: 'TASK-999',
          ...body,
          status: 'pending',
          created: new Date().toISOString()
        };
        await route.fulfill({
          status: 201,
          json: { task: newTask, created: true }
        });
      } else {
        await route.fulfill({ json: mockTasks });
      }
    });

    await page.route('**/api/repos', async (route) => {
      await route.fulfill({
        json: {
          repos: [{ id: 'default', name: 'Default', path: process.cwd() }],
          count: 1
        }
      });
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

  test('should open task creation modal when clicking New Task button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /New Task/i })).toBeVisible();
    
    await page.getByRole('button', { name: /New Task/i }).click();
    
    await expect(page.getByRole('heading', { name: 'Create New Task' })).toBeVisible();
    await expect(page.getByLabel(/Title/)).toBeVisible();
    await expect(page.getByLabel(/Description/)).toBeVisible();
    await expect(page.getByLabel(/Priority/)).toBeVisible();
  });

  test('should close modal when clicking Cancel', async ({ page }) => {
    await page.getByRole('button', { name: /New Task/i }).click();
    await expect(page.getByRole('heading', { name: 'Create New Task' })).toBeVisible();
    
    await page.getByRole('button', { name: /Cancel/i }).click();
    
    await expect(page.getByRole('heading', { name: 'Create New Task' })).not.toBeVisible();
  });

  test('should require title field', async ({ page }) => {
    await page.getByRole('button', { name: /New Task/i }).click();
    
    const createButton = page.getByRole('button', { name: /^Create Task$/i });
    await expect(createButton).toBeDisabled();
    
    await page.getByLabel(/Title/).fill('Test Task');
    await expect(createButton).toBeEnabled();
  });

  test('should create a new task with required fields', async ({ page }) => {
    await page.getByRole('button', { name: /New Task/i }).click();
    
    await page.getByLabel(/Title/).fill('New Feature Task');
    await page.getByLabel(/Description/).fill('This is a test task');
    await page.getByLabel(/Priority/).selectOption('high');
    
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    
    await page.waitForTimeout(500);
    
    await expect(page.getByRole('heading', { name: 'Create New Task' })).not.toBeVisible();
  });

  test('should create task with all optional fields', async ({ page }) => {
    await page.getByRole('button', { name: /New Task/i }).click();
    
    await page.getByLabel(/Title/).fill('Complete Feature Task');
    await page.getByLabel(/Description/).fill('Full task description');
    await page.getByLabel(/Priority/).selectOption('critical');
    await page.getByLabel(/Category/).fill('ui');
    await page.getByLabel(/Skill/).fill('pptx');
    
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    
    await page.waitForTimeout(500);
    
    await expect(page.getByRole('heading', { name: 'Create New Task' })).not.toBeVisible();
  });

  test('should reset form after successful creation', async ({ page }) => {
    await page.getByRole('button', { name: /New Task/i }).click();
    
    await page.getByLabel(/Title/).fill('First Task');
    await page.getByLabel(/Description/).fill('First description');
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    
    await page.waitForTimeout(500);
    
    await page.getByRole('button', { name: /New Task/i }).click();
    
    await expect(page.getByLabel(/Title/)).toHaveValue('');
    await expect(page.getByLabel(/Description/)).toHaveValue('');
    await expect(page.getByLabel(/Priority/)).toHaveValue('medium');
  });

  test('should display error message on creation failure', async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          json: { error: 'Internal server error' }
        });
      } else {
        await route.fulfill({ json: mockTasks });
      }
    });

    await page.goto('/');
    
    await page.getByRole('button', { name: /New Task/i }).click();
    await page.getByLabel(/Title/).fill('Error Task');
    await page.getByRole('button', { name: /^Create Task$/i }).click();
    
    await expect(page.getByText(/Internal server error/i)).toBeVisible();
  });

  test('should disable buttons while creating task', async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 201,
          json: { task: { id: 'TASK-999', title: 'Test', status: 'pending' }, created: true }
        });
      } else {
        await route.fulfill({ json: mockTasks });
      }
    });

    await page.goto('/');
    
    await page.getByRole('button', { name: /New Task/i }).click();
    await page.getByLabel(/Title/).fill('Slow Task');
    
    const createButton = page.getByRole('button', { name: /^Create Task$/i });
    await createButton.click();
    
    await expect(page.getByRole('button', { name: /Creating.../i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeDisabled();
  });
});
