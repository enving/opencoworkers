import { test, expect } from '@playwright/test';

test.describe('TASK-175: Collaborative Editing Integration', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:5173/');
    });

    test('should show Edit in Team button for editable artifacts', async ({ page }) => {
        // Navigate to a task with an editable artifact (e.g. .docx or .xlsx)
        // We assume TASK-169 has Ausgaben_2025.xlsx

        // Find task TASK-169 and click it
        const taskCard = page.locator('div').filter({ hasText: /^TASK-169/ }).first();
        await taskCard.click();

        // Check if the modal is open
        await expect(page.locator('h2')).toContainText('excel tabelle');

        // Look for the "Edit in Team" button (Users icon)
        const editButton = page.locator('button[title="Edit in Team"]').first();
        await expect(editButton).toBeVisible();
    });

    test('should open OnlyOffice editor iframe when clicking Edit in Team', async ({ page }) => {
        const taskCard = page.locator('div').filter({ hasText: /^TASK-169/ }).first();
        await taskCard.click();

        const editButton = page.locator('button[title="Edit in Team"]').first();
        await editButton.click();

        // Verify "Close Editor" button is visible
        await expect(page.locator('button:has-text("Close Editor")')).toBeVisible();

        // Verify iframe exists
        const iframe = page.locator('iframe[title="OnlyOffice Editor"]');
        await expect(iframe).toBeVisible();

        const src = await iframe.getAttribute('src');
        expect(src).toContain('/api/editor/');
        expect(src).toContain('file=Ausgaben_2025.xlsx');
    });
});
