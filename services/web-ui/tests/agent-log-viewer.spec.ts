import { test, expect } from '@playwright/test';

test.describe('Agent Log Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/tasks*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tasks: [],
          total: 0
        })
      });
    });

    await page.route('/api/repos*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          repos: [{ id: 'default', name: 'Default', path: '/test' }],
          count: 1
        })
      });
    });

    await page.route('/api/events', async (route) => {
      const headers = {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      };
      await route.fulfill({
        status: 200,
        headers,
        body: 'event: connected\ndata: {"timestamp":"2026-01-19T15:00:00.000Z"}\n\n'
      });
    });

    await page.route('/api/logs*', async (route) => {
      const url = new URL(route.request().url());
      const agentId = url.searchParams.get('agentId');
      const taskId = url.searchParams.get('taskId');
      const result = url.searchParams.get('result');

      let logs = [
        {
          timestamp: '2026-01-19T15:00:00.000Z',
          agentId: 'server-bridge',
          taskId: 'TASK-001',
          action: 'trigger-agent',
          details: { skill: 'pptx', sessionId: 'session-abc' },
          result: 'success'
        },
        {
          timestamp: '2026-01-19T14:59:00.000Z',
          agentId: 'data-analyst',
          taskId: 'TASK-002',
          action: 'analyze-data',
          details: { file: 'sales.xlsx', rows: 1000 },
          result: 'success'
        },
        {
          timestamp: '2026-01-19T14:58:00.000Z',
          agentId: 'server-bridge',
          taskId: 'TASK-003',
          action: 'trigger-agent',
          details: { skill: 'xlsx' },
          result: 'pending'
        },
        {
          timestamp: '2026-01-19T14:57:00.000Z',
          agentId: 'email-assistant',
          taskId: 'TASK-004',
          action: 'send-email',
          details: { error: 'SMTP connection failed' },
          result: 'failure'
        }
      ];

      if (agentId) {
        logs = logs.filter(log => log.agentId === agentId);
      }
      if (taskId) {
        logs = logs.filter(log => log.taskId === taskId);
      }
      if (result) {
        logs = logs.filter(log => log.result === result);
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs,
          count: logs.length,
          total: 4
        })
      });
    });

    await page.goto('/');
  });

  test('should display agent logs', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Agent Logs' })).toBeVisible();
    
    await expect(page.locator('.bg-blue-500\\/20').filter({ hasText: 'server-bridge' }).first()).toBeVisible();
    await expect(page.locator('.bg-purple-500\\/20').filter({ hasText: 'TASK-001' }).first()).toBeVisible();
    await expect(page.getByText('trigger-agent').first()).toBeVisible();
  });

  test('should show log count', async ({ page }) => {
    await expect(page.getByText('(4 entries)')).toBeVisible();
  });

  test('should filter logs by agent', async ({ page }) => {
    const agentFilter = page.locator('select').filter({ hasText: 'All Agents' });
    await agentFilter.selectOption('server-bridge');

    await page.waitForTimeout(500);

    await expect(page.locator('.bg-blue-500\\/20').filter({ hasText: 'server-bridge' }).first()).toBeVisible();
    await expect(page.locator('.bg-blue-500\\/20').filter({ hasText: 'data-analyst' })).not.toBeVisible();
  });

  test('should filter logs by task', async ({ page }) => {
    const taskFilter = page.locator('select').filter({ hasText: 'All Tasks' });
    await taskFilter.selectOption('TASK-002');

    await page.waitForTimeout(500);

    await expect(page.locator('.bg-purple-500\\/20').filter({ hasText: 'TASK-002' }).first()).toBeVisible();
    await expect(page.locator('.bg-purple-500\\/20').filter({ hasText: 'TASK-001' })).not.toBeVisible();
  });

  test('should filter logs by result', async ({ page }) => {
    const resultFilter = page.locator('select').filter({ hasText: 'All Results' });
    await resultFilter.selectOption('failure');

    await page.waitForTimeout(500);

    await expect(page.getByText('send-email')).toBeVisible();
    await expect(page.getByText('trigger-agent')).not.toBeVisible();
  });

  test('should display status icons', async ({ page }) => {
    const successIcon = page.locator('[class*="text-emerald"]').first();
    await expect(successIcon).toBeVisible();

    const resultFilter = page.locator('select').filter({ hasText: 'All Results' });
    await resultFilter.selectOption('failure');
    await page.waitForTimeout(500);

    const failureIcon = page.locator('[class*="text-rose"]').first();
    await expect(failureIcon).toBeVisible();
  });

  test('should expand log details on click', async ({ page }) => {
    const firstLogEntry = page.locator('.hover\\:bg-zinc-800\\/50').first();
    
    await expect(page.getByText('"skill": "pptx"')).not.toBeVisible();
    
    await firstLogEntry.click();
    
    await expect(page.getByText('"skill": "pptx"')).toBeVisible();
    await expect(page.getByText('"sessionId": "session-abc"')).toBeVisible();
  });

  test('should collapse expanded log details on second click', async ({ page }) => {
    const firstLogEntry = page.locator('.hover\\:bg-zinc-800\\/50').first();
    
    await firstLogEntry.click();
    await expect(page.getByText('"skill": "pptx"')).toBeVisible();
    
    await firstLogEntry.click();
    await expect(page.getByText('"skill": "pptx"')).not.toBeVisible();
  });

  test('should format timestamps correctly', async ({ page }) => {
    const timestamp = page.locator('text=/\\d{2}:\\d{2}:\\d{2}/').first();
    await expect(timestamp).toBeVisible();
  });

  test('should refresh logs on button click', async ({ page }) => {
    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeVisible();
    
    let requestCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/logs')) {
        requestCount++;
      }
    });

    await refreshButton.click();
    await page.waitForTimeout(500);
    
    expect(requestCount).toBeGreaterThan(0);
  });

  test('should handle empty logs gracefully', async ({ page }) => {
    await page.route('/api/logs*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          logs: [],
          count: 0,
          total: 0
        })
      });
    });

    await page.reload();
    await expect(page.getByText('No logs found')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.route('/api/logs*', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });

    await page.reload();
    await expect(page.getByText('Failed to load logs')).toBeVisible();
  });

  test('should display different result badges with correct colors', async ({ page }) => {
    const successBadge = page.locator('.text-emerald-400').first();
    await expect(successBadge).toBeVisible();

    const resultFilter = page.locator('select').filter({ hasText: 'All Results' });
    
    await resultFilter.selectOption('failure');
    await page.waitForTimeout(500);
    const failureBadge = page.locator('.text-rose-400').first();
    await expect(failureBadge).toBeVisible();

    await resultFilter.selectOption('pending');
    await page.waitForTimeout(500);
    const pendingBadge = page.locator('.text-amber-400').first();
    await expect(pendingBadge).toBeVisible();
  });

  test('should auto-refresh logs every 5 seconds', async ({ page }) => {
    let requestCount = 0;
    page.on('request', request => {
      if (request.url().includes('/api/logs')) {
        requestCount++;
      }
    });

    await page.waitForTimeout(6000);
    
    expect(requestCount).toBeGreaterThanOrEqual(2);
  });
});
