import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Compliance Audit Scenario - Real Verification', async ({ page }) => {
  test.setTimeout(600000); 

  // 1. Full HD Viewport
  await page.setViewportSize({ width: 1920, height: 1080 });

  // 2. Load Dashboard
  console.log('Loading dashboard...');
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(5000);
  
  // Auto-login
  await page.evaluate(() => {
    localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItYWRtaW4iLCJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzY5MTA2ODU5fQ.wU8xGBWyMja5NWw2WCjM7FcUN0DQ9JhwkRyGgabiF78');
  });
  await page.reload();
  await page.waitForTimeout(5000);

  // Handle Reconnect
  const reconnectBtn = page.getByRole('button', { name: 'Try Reconnect' });
  if (await reconnectBtn.isVisible()) {
    await reconnectBtn.click();
    await page.waitForTimeout(5000);
  }

  // Ensure connected
  await expect(page.getByText('Daemon Online')).toBeVisible({ timeout: 30000 });

  // 3. Create Task
  const title = `Compliance Audit ${Date.now()}`;
  const newTaskBtn = page.locator('button').filter({ hasText: /New Task/i }).first();
  await newTaskBtn.click();
  
  await page.locator('input#title').fill(title);
  await page.waitForTimeout(1000);
  await page.locator('#description').fill('Perform a full compliance audit check. Use the bash tool to list directories and check security configuration.');
  await page.waitForTimeout(1000);
  await page.locator('#skill').fill('general');
  await page.waitForTimeout(1000);
  await page.getByLabel('Priority').selectOption('high');
  await page.waitForTimeout(2000);
  
  await page.getByTestId('create-task-submit').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const taskCard = page.locator('.task-card', { hasText: title }).first();
  await expect(taskCard).toBeVisible({ timeout: 20000 });
  await page.waitForTimeout(3000);

  // 4. Drag to In Progress
  const inProgressColumn = page.getByTestId('column-in_progress');
  const cardBox = await taskCard.boundingBox();
  const columnBox = await inProgressColumn.boundingBox();
  
  if (cardBox && columnBox) {
    await page.mouse.move(cardBox.x + cardBox.width / 2, cardBox.y + cardBox.height / 2);
    await page.waitForTimeout(2000);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await page.mouse.move(columnBox.x + columnBox.width / 2, columnBox.y + 250, { steps: 100 });
    await page.waitForTimeout(2000);
    await page.mouse.up();
  }
  
  // 5. Observe Real Progress
  const approveBtn = page.getByRole('button', { name: 'Approve' });
  let completed = false;
  const startTime = Date.now();
  while (!completed && Date.now() - startTime < 600000) {
    if (await approveBtn.isVisible()) {
      await approveBtn.click();
      await page.waitForTimeout(2000);
    }
    
    if (await taskCard.getByText('completed').isVisible()) {
      completed = true;
      break;
    }
    await page.waitForTimeout(5000);
  }

  // 6. Verify Artifacts
  await expect(taskCard.locator('text=Generated Artifacts')).toBeVisible({ timeout: 60000 });
  await expect(taskCard.locator('a').first()).toBeVisible({ timeout: 20000 });

  console.log('Verification successful: Compliance task completed with real artifacts.');
  await page.waitForTimeout(10000); 
});
