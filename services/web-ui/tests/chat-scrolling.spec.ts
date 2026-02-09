import { test, expect } from '@playwright/test';

/**
 * Chat Scrolling Test - Specific test for scrolling behavior
 * This test verifies that the chat properly scrolls to show the latest messages
 */

test('Chat Scrolling Behavior', async ({ page }) => {
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

    // 2. Send multiple messages to test scrolling
    console.log('Testing scrolling behavior with multiple messages...');
    
    // Get the messages container - use a more reliable selector
    const messagesContainer = page.locator('.overflow-y-auto.px-6.py-4.space-y-4');
    
    // Send first message
    const firstMessage = `First test message ${Date.now()}`;
    await page.getByPlaceholder('Type your message...').fill(firstMessage);
    await page.getByPlaceholder('Type your message...').press('Enter');
    
    // Wait for user message to appear
    await expect(page.locator('div').filter({ hasText: firstMessage }).last()).toBeVisible();
    
    // Check scroll position - should be at bottom
    const initialScrollHeight = await messagesContainer.evaluate(el => el.scrollHeight);
    const initialScrollTop = await messagesContainer.evaluate(el => el.scrollTop);
    const initialClientHeight = await messagesContainer.evaluate(el => el.clientHeight);
    
    console.log(`Initial scroll: height=${initialScrollHeight}, top=${initialScrollTop}, client=${initialClientHeight}`);
    
    // Send second message
    const secondMessage = `Second test message ${Date.now()}`;
    await page.getByPlaceholder('Type your message...').fill(secondMessage);
    await page.getByPlaceholder('Type your message...').press('Enter');
    
    // Wait for second user message to appear
    await expect(page.locator('div').filter({ hasText: secondMessage }).last()).toBeVisible();
    
    // Check scroll position again
    const afterSecondScrollHeight = await messagesContainer.evaluate(el => el.scrollHeight);
    const afterSecondScrollTop = await messagesContainer.evaluate(el => el.scrollTop);
    const afterSecondClientHeight = await messagesContainer.evaluate(el => el.clientHeight);
    
    console.log(`After second message: height=${afterSecondScrollHeight}, top=${afterSecondScrollTop}, client=${afterSecondClientHeight}`);
    
    // Verify that we're scrolled to the bottom
    // The scrollTop + clientHeight should be close to scrollHeight
    const scrollPosition = afterSecondScrollTop + afterSecondClientHeight;
    const scrollDifference = afterSecondScrollHeight - scrollPosition;
    
    console.log(`Scroll position: ${scrollPosition}, scroll height: ${afterSecondScrollHeight}, difference: ${scrollDifference}`);
    
    // Allow some tolerance for smooth scrolling
    expect(scrollDifference).toBeLessThan(50); // Should be very close to bottom
    
    // 3. Test with long messages to ensure scrolling works with overflow
    console.log('Testing with long message...');
    
    const longMessage = 'Long message\n'.repeat(20) + `Long test message ${Date.now()}`;
    await page.getByPlaceholder('Type your message...').fill(longMessage);
    await page.getByPlaceholder('Type your message...').press('Enter');
    
    // Wait for long message to appear
    await expect(page.locator('div').filter({ hasText: 'Long test message' }).last()).toBeVisible();
    
    // Check scroll position after long message
    const afterLongScrollHeight = await messagesContainer.evaluate(el => el.scrollHeight);
    const afterLongScrollTop = await messagesContainer.evaluate(el => el.scrollTop);
    const afterLongClientHeight = await messagesContainer.evaluate(el => el.clientHeight);
    
    console.log(`After long message: height=${afterLongScrollHeight}, top=${afterLongScrollTop}, client=${afterLongClientHeight}`);
    
    // Verify we're still at the bottom
    const longScrollPosition = afterLongScrollTop + afterLongClientHeight;
    const longScrollDifference = afterLongScrollHeight - longScrollPosition;
    
    console.log(`Long message scroll position: ${longScrollPosition}, scroll height: ${afterLongScrollHeight}, difference: ${longScrollDifference}`);
    
    expect(longScrollDifference).toBeLessThan(50); // Should still be at bottom
    
    console.log('Scrolling test completed successfully!');
});