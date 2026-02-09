import { test, expect } from '@playwright/test';

test('Admin Config Verification', async ({ page }) => {
    test.setTimeout(60000); // Increase total timeout

    // 1. Navigation with slow steps
    console.log('Navigating to dashboard...');
    await page.goto('http://localhost:5173');
    // Wait for the app to actually load (look for Sidebar title)
    await expect(page.locator('aside').getByText('OpenCoworkers')).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to Settings - look for button with "Settings" in Sidebar
    console.log('Clicking Settings...');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(2000);

    // 2. Admin Config Panel
    console.log('Verifying OpenCode Configuration header...');
    // Wait longer for config to load
    await expect(page.getByText('OpenCode Configuration')).toBeVisible({ timeout: 15000 });

    // 3. Agent Groups (New Feature)
    console.log('Verifying Agent Groups...');
    // Ensure we are on Groups tab (it's default) or click it
    await page.getByRole('button', { name: 'Groups' }).click();

    await expect(page.getByText('Minimal')).toBeVisible();
    await expect(page.getByText('Standard')).toBeVisible();

    // 4. Provider Management
    console.log('Clicking Providers tab...');
    // Use getByRole for better accessibility matching
    await page.getByRole('button', { name: 'Providers' }).click();
    await page.waitForTimeout(500);

    // Click "Add Provider"
    console.log('Adding Provider...');
    await page.getByRole('button', { name: 'Add Provider' }).click();
    await page.waitForTimeout(1000);

    // Fill Form
    await page.getByPlaceholder('e.g., anthropic, openai').fill('my-openai-provider');
    await page.getByPlaceholder('sk-...').fill('sk-test-verification-key');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);

    // Verify it was added
    await expect(page.getByText('my-openai-provider')).toBeVisible();

    // 4. MCP Servers
    console.log('Clicking MCP Servers tab...');
    await page.getByRole('button', { name: 'MCP Servers' }).click();
    await page.waitForTimeout(1000);

    // Toggle Presets (click "Add MCP Server")
    console.log('Adding MCP Server...');
    await page.getByRole('button', { name: 'Add MCP Server' }).click();
    await page.waitForTimeout(500);

    // Choose "Filesystem" from presets
    await page.getByText('Filesystem').first().click();
    await page.waitForTimeout(1000);

    // Verify "filesystem" is listed.
    await expect(page.getByText('filesystem')).toBeVisible();

    // 5. Persistence
    console.log('Reloading page...');
    await page.reload();
    await page.waitForTimeout(3000);

    console.log('Navigating back to settings...');
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(2000);

    // Check Provider
    console.log('Verifying persistence...');
    await page.getByRole('button', { name: 'Providers' }).click();
    await expect(page.getByText('my-openai-provider')).toBeVisible();

    // Check MCP Server
    await page.getByRole('button', { name: 'MCP Servers' }).click();
    await expect(page.getByText('filesystem')).toBeVisible();
});
