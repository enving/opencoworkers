import { test, expect } from '@playwright/test';

test.describe('OCCM Skills Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await expect(page.locator('aside').getByText('OpenCoworkers')).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Settings' }).click();
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'Skills' }).click();
        await page.waitForTimeout(1000);
    });

    test('Skills tab displays correctly', async ({ page }) => {
        // Verify basic UI elements
        await expect(page.getByPlaceholder('Search skills...')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create New Skill' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Import' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Marketplace' })).toBeVisible();
    });

    test('Import skill modal opens correctly', async ({ page }) => {
        await page.getByRole('button', { name: 'Import' }).click();
        await page.waitForTimeout(500);

        // Verify Import UI elements
        await expect(page.getByRole('heading', { name: 'Import Skill' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'From GitHub' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'From Local Path' })).toBeVisible();

        // Test switching between import types
        await page.getByRole('button', { name: 'From Local Path' }).click();
        await expect(page.getByPlaceholder('/path/to/skill or ./my-skill')).toBeVisible();

        await page.getByRole('button', { name: 'From GitHub' }).click();
        await expect(page.getByPlaceholder('user/repo or https://github.com/user/repo')).toBeVisible();
    });

    test('Marketplace modal opens correctly', async ({ page }) => {
        await page.getByRole('button', { name: 'Marketplace' }).click();
        await page.waitForTimeout(500);

        // Verify Marketplace UI elements
        await expect(page.getByText('Skill Marketplace')).toBeVisible();
        await expect(page.getByPlaceholder('Search marketplace...')).toBeVisible();
        await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    });

    test('Create skill form opens correctly', async ({ page }) => {
        await page.getByRole('button', { name: 'Create New Skill' }).click();
        await page.waitForTimeout(500);

        // Verify form elements
        await expect(page.getByRole('heading', { name: 'Create New Skill' })).toBeVisible();
        await expect(page.getByPlaceholder('e.g. data-analyzer')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Save Skill' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

        // Test cancel returns to list
        await page.getByRole('button', { name: 'Cancel' }).click();
        await expect(page.getByRole('button', { name: 'Create New Skill' })).toBeVisible();
    });
});

test.describe('OCCM Backup Feature', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173');
        await expect(page.locator('aside').getByText('OpenCoworkers')).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: 'Settings' }).click();
        await page.waitForTimeout(1000);
        await page.getByRole('button', { name: 'Backup' }).click();
        await page.waitForTimeout(1000);
    });

    test('Backup tab displays correctly', async ({ page }) => {
        // Verify Backups section is default
        await expect(page.getByText('Config Backups')).toBeVisible();
        await expect(page.getByPlaceholder('Backup description (optional)')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Create Backup' })).toBeVisible();
    });

    test('Validation section works', async ({ page }) => {
        await page.getByRole('button', { name: 'Validation' }).click();
        await page.waitForTimeout(500);

        await expect(page.getByText('Config Validation')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Re-validate' })).toBeVisible();
    });

    test('External Import section works', async ({ page }) => {
        await page.getByRole('button', { name: 'External Import' }).click();
        await page.waitForTimeout(500);

        await expect(page.getByText('External Config Import')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Re-scan' })).toBeVisible();
        await expect(page.getByText('Supported External Tools')).toBeVisible();

        // Verify external tools are listed (at least some)
        await expect(page.getByText('Claude Desktop')).toBeVisible();
        await expect(page.getByText('Cursor')).toBeVisible();
    });
});
