import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function verifyRemoteVisibility() {
  console.log('🚀 Starting Verification for US-2: Remote Visibility...');

  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-us-2',
    password: 'opencode-sandbox'
  });

  const testTask: Task = {
    id: 'TASK-US-2-VERIFY' as any,
    title: 'Verify Remote Visibility',
    description: 'Count to 5 with 1 second delay between each number. Print each number.',
    status: 'in_progress',
    priority: 'medium',
    skill: 'general',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    console.log('--- Step 1: Trigger Task and Subscribe to Stream ---');
    
    // We listen to events BEFORE triggering to capture everything
    const events: any[] = [];
    bridge.on('event', (event) => {
      // Filter for message updates
      if (event.type === 'message.part.updated') {
        process.stdout.write('.'); // Visual feedback
        events.push(event);
      }
    });

    const sessionId = await bridge.triggerTaskExecution(testTask);
    if (!sessionId) {
      throw new Error('Failed to trigger task execution');
    }
    console.log(`\n✅ Session created: ${sessionId}`);

    console.log('\n--- Step 2: Monitor Real-time Stream ---');
    // Wait for completion while collecting events
    let status = 'running';
    let attempts = 0;
    while (status === 'running' || status === 'pending' || status === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await bridge.getSessionStatus(sessionId);
      attempts++;
      if (attempts > 30) { // 60s timeout
        throw new Error('Task timed out');
      }
    }

    console.log(`\nTask finished with status: ${status}`);

    console.log('\n--- Step 3: Analyze Streamed Events ---');
    console.log(`Total 'message.part.updated' events received: ${events.length}`);

    // Verify we got multiple updates (streaming behavior)
    if (events.length > 3) {
      console.log('✅ Stream confirmed: Multiple incremental updates received.');
    } else {
      console.log('❌ Stream FAILED: Too few updates received (batch response?).');
    }

    // Verify content
    const lastEvent = events[events.length - 1];
    if (lastEvent) {
      console.log('Last event sample:', JSON.stringify(lastEvent).substring(0, 100) + '...');
    }
    
    // We don't check full content equality, just that we got the stream
    if (events.length > 3) {
      console.log('\n✨ US-2 Verification PASSED!');
    } else {
      console.log('\n❌ US-2 Verification FAILED!');
    }

  } catch (error: any) {
    console.error('\n❌ Verification FAILED!');
    console.error(error);
  }
}

verifyRemoteVisibility();
