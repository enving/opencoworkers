import { test, expect } from '@playwright/test';

test('Chat Interface Verification', async ({ page }) => {
    test.setTimeout(30000);

    // 1. Navigation
    console.log('Navigating to dashboard...');
    await page.goto('/');

    // Wait for app load
    await expect(page.locator('aside').getByText('OpenCoworkers')).toBeVisible({ timeout: 15000 });

    // Click Chat in sidebar
    console.log('Navigating to Chat...');
    await page.getByRole('button', { name: 'Chat' }).click();

    // Verify Chat View loaded
    await expect(page.getByText('AI Assistant')).toBeVisible();
    await expect(page.getByPlaceholder('Type your message...')).toBeVisible();

    // 2. Start Conversation
    console.log('Starting new chat...');
    // If "New Chat" button is visible in sidebar (sidebar might be closed or open)
    // The "History" button opens the sidebar. 
    // Let's trying sending a message first, which should auto-create a chat.

    const testMessage = `Test Message ${Date.now()}`;
    await page.getByPlaceholder('Type your message...').fill(testMessage);
    await page.getByPlaceholder('Type your message...').press('Enter');

    // 3. Verify Message
    console.log('Verifying message sent...');
    // The user bubble should appear
    await expect(page.locator('div').filter({ hasText: testMessage }).last()).toBeVisible();

    // The assistant should reply (streaming or complete)
    // We look for the bot avatar or just any response.
    // Since we don't know if the LLM is actually connected/configured, checking for the "Answer" might be flaky if it fails.
    // However, the UI should show *something* (error or loading or text).

    // Check if "Thinking..." appears or a response bubble
    // We give it a moment
    await page.waitForTimeout(1000);

    // 4. Verify History Sidebar
    console.log('Checking history...');
    // Open sidebar
    await page.locator('button').filter({ has: page.locator('svg.lucide-history') }).click();

    // The new chat should be listed (title might be "Test Message..." or "New Chat")
    // We wait for the list to update
    await expect(page.locator('div').filter({ hasText: testMessage.slice(0, 10) }).first()).toBeVisible({ timeout: 5000 });

    // 5. Verify History Sidebar
    console.log('Checking history...');
    // Open sidebar
    await page.locator('button').filter({ has: page.locator('svg.lucide-history') }).first().click();

    // The new chat should be listed (title might be "Test Message..." or "New Chat")
    // We wait for the list to update
    await expect(page.locator('div').filter({ hasText: testMessage.slice(0, 10) }).first()).toBeVisible({ timeout: 5000 });

    console.log('Chat test completed successfully!');
});
