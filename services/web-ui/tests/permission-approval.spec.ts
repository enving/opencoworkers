import { test, expect } from '@playwright/test';
import { mockTasks } from './fixtures/mock-data';

test.describe('Permission Approval', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/tasks', async (route) => {
      await route.fulfill({ json: mockTasks });
    });

    await page.route('**/api/repos', async (route) => {
      await route.fulfill({
        json: { repos: [{ id: 'default', name: 'Default', path: process.cwd() }], count: 1 }
      });
    });

    await page.route('**/api/status', async (route) => {
      await route.fulfill({
        json: { status: 'running', uptime: 3600, version: '1.0.0' }
      });
    });

    await page.goto('/');
  });

  test('should display permission modal when permission_requested event is received', async ({ page }) => {
    const permissionRequest = {
      id: 'perm-123',
      action: 'file:write',
      description: 'Agent wants to write to config.json',
      filePaths: ['/path/to/config.json'],
      taskId: 'TASK-001',
      sessionId: 'session-abc123',
      timestamp: new Date().toISOString()
    };

    page.on('console', msg => console.log('Browser console:', msg.text()));

    await page.evaluate((permission) => {
      const event = new MessageEvent('message', {
        data: `event: permission_requested\ndata: ${JSON.stringify({ permission })}\n\n`
      });
      const eventSource = (window as any)._mockEventSource;
      if (eventSource && eventSource.onmessage) {
        eventSource.onmessage(event);
      }
    }, permissionRequest);

    await page.waitForTimeout(500);
  });

  test('should display permission modal with correct information', async ({ page }) => {
    await page.route('**/api/events', async (route) => {
      const stream = `event: connected
data: {"timestamp":"2026-01-19T15:00:00.000Z"}

event: permission_requested
data: {"permission":{"id":"perm-456","action":"file:delete","description":"Agent wants to delete old logs","filePaths":["/logs/old.log","/logs/archive.log"],"taskId":"TASK-002","timestamp":"2026-01-19T15:00:00.000Z"}}

`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: stream
      });
    });

    await page.goto('/');
    
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('Agent Permission Required')).toBeVisible({timeout: 5000});
    await expect(page.getByText('file:delete')).toBeVisible();
    await expect(page.getByText('Agent wants to delete old logs')).toBeVisible();
    await expect(page.getByText('/logs/old.log')).toBeVisible();
    await expect(page.getByText('Task: TASK-002')).toBeVisible();
  });

  test('should approve permission with "Allow Once"', async ({ page }) => {
    let approvalReceived = false;

    await page.route('**/api/permissions/perm-789', async (route) => {
      const body = route.request().postDataJSON();
      approvalReceived = true;
      expect(body.action).toBe('approve');
      expect(body.approvalType).toBe('once');
      
      await route.fulfill({
        json: { success: true, action: 'approve', permissionId: 'perm-789' }
      });
    });

    await page.route('**/api/events', async (route) => {
      const stream = `event: connected
data: {"timestamp":"2026-01-19T15:00:00.000Z"}

event: permission_requested
data: {"permission":{"id":"perm-789","action":"command:exec","description":"Execute npm install","taskId":"TASK-003","timestamp":"2026-01-19T15:00:00.000Z"}}

`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: stream
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('Agent Permission Required')).toBeVisible({timeout: 5000});
    
    const onceRadio = page.getByRole('radio', { name: /Allow Once/ });
    await expect(onceRadio).toBeChecked();
    
    await page.getByRole('button', { name: /^Approve$/i }).click();
    
    await page.waitForTimeout(500);
    
    expect(approvalReceived).toBe(true);
  });

  test('should approve permission with "Allow Always"', async ({ page }) => {
    let approvalReceived = false;

    await page.route('**/api/permissions/perm-101', async (route) => {
      const body = route.request().postDataJSON();
      approvalReceived = true;
      expect(body.action).toBe('approve');
      expect(body.approvalType).toBe('always');
      
      await route.fulfill({
        json: { success: true, action: 'approve', permissionId: 'perm-101' }
      });
    });

    await page.route('**/api/events', async (route) => {
      const stream = `event: connected
data: {"timestamp":"2026-01-19T15:00:00.000Z"}

event: permission_requested
data: {"permission":{"id":"perm-101","action":"file:read","description":"Read configuration file","taskId":"TASK-004","timestamp":"2026-01-19T15:00:00.000Z"}}

`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: stream
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('Agent Permission Required')).toBeVisible({timeout: 5000});
    
    await page.getByRole('radio', { name: /Allow Always/ }).click();
    await expect(page.getByRole('radio', { name: /Allow Always/ })).toBeChecked();
    
    await page.getByRole('button', { name: /^Approve$/i }).click();
    
    await page.waitForTimeout(500);
    
    expect(approvalReceived).toBe(true);
  });

  test('should deny permission', async ({ page }) => {
    let denyReceived = false;

    await page.route('**/api/permissions/perm-202', async (route) => {
      const body = route.request().postDataJSON();
      denyReceived = true;
      expect(body.action).toBe('deny');
      
      await route.fulfill({
        json: { success: true, action: 'deny', permissionId: 'perm-202' }
      });
    });

    await page.route('**/api/events', async (route) => {
      const stream = `event: connected
data: {"timestamp":"2026-01-19T15:00:00.000Z"}

event: permission_requested
data: {"permission":{"id":"perm-202","action":"system:restart","description":"Restart the application","taskId":"TASK-005","timestamp":"2026-01-19T15:00:00.000Z"}}

`;
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
        body: stream
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);
    
    await expect(page.getByText('Agent Permission Required')).toBeVisible({timeout: 5000});
    
    await page.getByRole('button', { name: /^Deny$/i }).click();
    
    await page.waitForTimeout(500);
    
    expect(denyReceived).toBe(true);
  });
});
