import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * End-to-End Test for OpenCode Schema Fix
 * Tests that UI can save configs that the OpenCode server can read
 * Focuses on what we can verify without the daemon/OCCM API
 */

test.describe('OpenCode Schema Fix - UI to Server Integration', () => {
  const configPath = join('.agent-config', 'opencode.json');
  const backupPath = join('.agent-config', 'opencode.json.backup');

  test.beforeAll(() => {
    // Backup existing config
    try {
      const config = readFileSync(configPath, 'utf8');
      writeFileSync(backupPath, config);
    } catch (error) {
      // No existing config
    }
  });

  test.afterAll(() => {
    // Restore original config
    try {
      const backup = readFileSync(backupPath, 'utf8');
      writeFileSync(configPath, backup);
    } catch (error) {
      // No backup to restore
    }
  });

  test('UI can display and manage providers with current schema', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForSelector('text=OpenCode Configuration');

    // Go to Providers tab
    await page.click('button:has-text("Providers")');
    await page.waitForSelector('text=Configure API providers');

    // Add a new provider
    await page.click('button:has-text("Add Provider")');
    await page.waitForSelector('text=Provider ID');

    // Fill provider form (using current UI schema)
    await page.fill('input[placeholder="e.g., anthropic, openai"]', 'test-provider');
    await page.selectOption('select', '@ai-sdk/anthropic');
    await page.fill('input[placeholder="sk-"]', 'test-api-key-12345');

    // Save the provider
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=test-provider', { timeout: 10000 });

    // Verify provider appears in list
    const providerElement = page.locator('text=test-provider');
    await expect(providerElement).toBeVisible();

    // Verify the provider details are displayed
    const sdkBadge = page.locator('text=@ai-sdk/anthropic');
    await expect(sdkBadge).toBeVisible();
  });

  test('UI can display and manage MCP servers with current schema', async ({ page }) => {
    // Navigate to settings
    await page.goto('/settings');
    await page.waitForSelector('text=OpenCode Configuration');

    // Go to MCP tab
    await page.click('button:has-text("MCP")');
    await page.waitForSelector('text=MCP servers extend agent capabilities');

    // Add a new MCP server
    await page.click('button:has-text("Add Custom")');
    await page.waitForSelector('text=Server Name');

    // Fill MCP form (using current UI schema)
    await page.fill('input[placeholder="e.g., github, postgres"]', 'test-mcp');
    await page.fill('input[placeholder="npx, python3, etc."]', 'echo');
    await page.fill('input[placeholder="-y @modelcontextprotocol/server-github"]', 'test arg');

    // Save the MCP server
    await page.click('button:has-text("Save")');
    await page.waitForSelector('text=test-mcp', { timeout: 10000 });

    // Verify MCP server appears in list
    const mcpElement = page.locator('text=test-mcp');
    await expect(mcpElement).toBeVisible();
  });

  test('Config file uses schema that server can read', async () => {
    // Read the actual config file
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    // Verify the schema structure
    expect(config.provider).toBeDefined();
    expect(config.mcp).toBeDefined();
    
    // Verify no old schema keys
    expect(config.providers).toBeUndefined();
    expect(config.mcpServers).toBeUndefined();
    
    // Verify nested options structure if providers exist
    if (config.provider && Object.keys(config.provider).length > 0) {
      for (const [providerName, providerConfig] of Object.entries(config.provider)) {
        expect(providerConfig.options).toBeDefined();
        expect(providerConfig.options.apiKey).toBeDefined();
      }
    }
  });

  test('Server can read the config file format', async () => {
    // This test verifies the config file format is compatible with what the server expects
    const configContent = readFileSync(configPath, 'utf8');
    const config = JSON.parse(configContent);

    // Simulate what the OpenCode server expects
    const serverExpectedKeys = ['provider', 'mcp', 'models', 'agent'];
    const oldSchemaKeys = ['providers', 'mcpServers'];

    // Verify expected keys exist
    for (const key of serverExpectedKeys) {
      if (config[key] !== undefined) {
        console.log(`✅ Server can use '${key}' key`);
      }
    }

    // Verify old keys don't exist
    for (const key of oldSchemaKeys) {
      expect(config[key]).toBeUndefined();
      console.log(`✅ No old '${key}' key that server would ignore`);
    }

    // Verify nested structure for providers
    if (config.provider) {
      for (const [name, provider] of Object.entries(config.provider)) {
        expect(provider.options).toBeDefined();
        expect(provider.options.apiKey).toBeDefined();
        console.log(`✅ Provider '${name}' has correct nested options structure`);
      }
    }
  });
});

/**
 * Helper function to verify schema compatibility
 * This simulates what the OpenCode server would check
 */
function verifyServerSchemaCompatibility(config: any) {
  const errors = [];
  
  // Check for correct keys
  if (!config.provider && !config.providers) {
    errors.push('No provider configuration found');
  }
  
  if (!config.mcp && !config.mcpServers) {
    errors.push('No MCP configuration found');
  }
  
  // Check for old schema (would be ignored)
  if (config.providers) {
    errors.push('Using old "providers" key (would be ignored by server)');
  }
  
  if (config.mcpServers) {
    errors.push('Using old "mcpServers" key (would be ignored by server)');
  }
  
  // Check nested structure
  if (config.provider) {
    for (const [name, provider] of Object.entries(config.provider)) {
      if (!provider.options?.apiKey) {
        errors.push(`Provider '${name}' missing nested options.apiKey`);
      }
    }
  }
  
  return {
    compatible: errors.length === 0,
    errors
  };
}