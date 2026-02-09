import { test, expect } from '@playwright/test';

/**
 * Showcase: Refinement Loop (Ralph Wiggum Loop) Feature
 * 
 * This test demonstrates the new toggle feature in Settings that enables
 * automatic session archiving and context injection for task refinements.
 */
test('Showcase - Refinement Loop Toggle Feature', async ({ page }) => {
    test.setTimeout(120000);

    // 1. Full HD Viewport for showcase recording
    await page.setViewportSize({ width: 1920, height: 1080 });

    // 2. Load Dashboard
    console.log('🎬 Starting Refinement Loop Showcase...');
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(3000);

    // Auto-login
    await page.evaluate(() => {
        localStorage.setItem('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InVzZXItYWRtaW4iLCJ1c2VybmFtZSI6ImFkbWluIiwiaWF0IjoxNzY5MTA2ODU5fQ.wU8xGBWyMja5NWw2WCjM7FcUN0DQ9JhwkRyGgabiF78');
    });
    await page.reload();
    await page.waitForTimeout(3000);

    // Handle Reconnect if needed
    const reconnectBtn = page.getByRole('button', { name: 'Try Reconnect' });
    if (await reconnectBtn.isVisible()) {
        await reconnectBtn.click();
        await page.waitForTimeout(3000);
    }

    // 3. Navigate to Settings
    console.log('📍 Navigating to Settings...');
    const settingsLink = page.locator('a[href="/settings"], button:has-text("Settings")').first();
    await settingsLink.click();
    await page.waitForTimeout(2000);

    // 4. Scroll to Advanced Features section
    console.log('⚡ Locating Advanced Features section...');
    const advancedFeaturesHeader = page.getByText('Advanced Features');
    await advancedFeaturesHeader.scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);

    // 5. Verify the Refinement Loop Toggle is visible
    const refinementLoopCard = page.locator('div').filter({ hasText: /Refinement Loop.*Ralph Wiggum Loop/i }).first();
    await expect(refinementLoopCard).toBeVisible({ timeout: 10000 });
    console.log('✅ Refinement Loop card found');

    // Take screenshot showing the toggle OFF state
    await page.screenshot({
        path: 'tests/artifacts/TASK-174/refinement-toggle-off.png',
        fullPage: false
    });
    await page.waitForTimeout(2000);

    // 6. Click the toggle to enable Refinement Loop
    console.log('🔄 Enabling Refinement Loop...');
    const toggle = refinementLoopCard.locator('button[class*="rounded-full"]');
    await toggle.click();
    await page.waitForTimeout(2000);

    // 7. Verify the info box appears when enabled
    const infoBox = refinementLoopCard.locator('text=When enabled, tasks moved to "Refinement"');
    await expect(infoBox).toBeVisible({ timeout: 10000 });
    console.log('✅ Info box appeared - Toggle is ON');

    // Take screenshot showing the toggle ON state
    await page.screenshot({
        path: 'tests/artifacts/TASK-174/refinement-toggle-on.png',
        fullPage: false
    });
    await page.waitForTimeout(3000);

    // 8. Scroll down to show context (Permissions section below)
    await page.evaluate(() => window.scrollBy(0, 100));
    await page.waitForTimeout(2000);

    // 9. Toggle OFF again to show the animation
    console.log('🔄 Toggling OFF to show animation...');
    await toggle.click();
    await page.waitForTimeout(1500);

    // 10. Toggle ON one more time for final state
    console.log('🔄 Final toggle ON...');
    await toggle.click();
    await page.waitForTimeout(3000);

    // 11. Final screenshot
    await page.screenshot({
        path: 'tests/artifacts/TASK-174/refinement-feature-complete.png',
        fullPage: true
    });

    console.log('🎬 Showcase complete!');
    await page.waitForTimeout(5000);
});
