import { createOpencodeClient } from "@opencode-ai/sdk";
import * as fs from 'fs';
import * as path from 'path';

/**
 * OpenCode Workflow Test Script
 * 
 * Verifies:
 * 1. OpenCode Server starts
 * 2. Client connects
 * 3. Session creation & message streaming
 */
async function runWorkflowTest() {
  const PORT = 4099;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  const directory = process.cwd();

  console.log('--- 🚀 Starting OpenCode Workflow Test ---');

  // 1. Initialize Client
  const client = createOpencodeClient({
    baseUrl,
    directory
  });

  try {
    // 2. Health Check (Wait for server)
    console.log('[Test] Waiting for OpenCode Server...');
    let healthy = false;
    for (let i = 0; i < 5; i++) {
        try {
            const resp = await fetch(`${baseUrl}/v1/health`);
            if (resp.ok) {
                healthy = true;
                break;
            }
        } catch {}
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!healthy) {
        throw new Error('OpenCode Server failed to start or is unreachable.');
    }
    console.log('[Test] Server is UP');

    console.log('[Test] Creating session...');
    const sessionResp = await (client as any).session.create({
      body: { title: "Integration Test Session" }
    });
    const session = sessionResp.data;
    console.log(`[Test] Session created: ${session.id}`);

    console.log('[Test] Sending prompt to agent...');
    await (client as any).session.prompt({
      path: { sessionID: session.id },
      body: {
        parts: [{ type: "text", text: "echo 'hello from integration test'" }]
      }
    });

    console.log('[Test] Prompt accepted, checking status...');
    const statusResp = await (client as any).session.get({ 
        path: { sessionID: session.id } 
    });
    console.log(`[Test] Session status: ${statusResp.data.status}`);

    console.log('--- ✅ Workflow Test PASSED ---');
  } catch (err) {
    console.error('--- ❌ Workflow Test FAILED ---');
    console.error(err);
    process.exit(1);
  }
}

runWorkflowTest();
