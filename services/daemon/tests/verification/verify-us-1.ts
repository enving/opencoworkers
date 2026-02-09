import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';
import axios from 'axios';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';
const AUTH = {
  username: 'opencode',
  password: 'opencode-sandbox'
};

async function verifySafeExecution() {
  console.log('🚀 Starting Verification for US-1: Safe Execution...');

  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-us-1', // Working directory on VPS
    password: 'opencode-sandbox'
  });

  const testTask: Task = {
    id: 'TASK-US-1-VERIFY' as any,
    title: 'Verify Safe Execution',
    description: 'Create a file named US-1-SAFE.txt with content "VERIFIED-SAFE-EXECUTION"',
    status: 'in_progress',
    priority: 'high',
    skill: 'general',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    console.log('--- Step 1: Trigger Task Execution ---');
    const sessionId = await bridge.triggerTaskExecution(testTask);
    if (!sessionId) {
      throw new Error('Failed to trigger task execution');
    }
    console.log(`✅ Session created: ${sessionId}`);

    console.log('\n--- Step 2: Wait for Completion ---');
    let status = 'running';
    let attempts = 0;
    while (status === 'running' || status === 'pending' || status === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await bridge.getSessionStatus(sessionId);
      console.log(`Current status: ${status}`);
      attempts++;
      if (attempts > 24) { // 2 minutes timeout
        throw new Error('Task timed out');
      }
    }

    if (status !== 'idle') {
      throw new Error(`Task failed with status: ${status}`);
    }
    console.log('✅ Task completed successfully.');

    console.log('\n--- Step 3: Verify Filesystem Change on VPS ---');
    // We use the bridge client to create a verification session
    const verifySessionResult = await bridge['client'].session.create({
      body: { title: 'US-1 Verification Check' }
    });
    
    if (verifySessionResult.error || !verifySessionResult.data) {
      throw new Error(`Failed to create verification session: ${JSON.stringify(verifySessionResult.error)}`);
    }

    const verifySessionId = verifySessionResult.data.id;
    console.log(`Verification session: ${verifySessionId}`);

    const promptResult = await bridge['client'].session.promptAsync({
      path: { id: verifySessionId },
      body: {
        agent: 'general',
        parts: [{
          type: 'text',
          text: 'Check if the file "US-1-SAFE.txt" exists in "/root/sandbox/verify-us-1" and read its content. Use the bash tool.'
        }]
      }
    });

    if (promptResult.error) {
      throw new Error(`Failed to prompt verification session: ${JSON.stringify(promptResult.error)}`);
    }

    console.log('Awaiting verification output...');
    let verifyStatus = 'running';
    let verifyAttempts = 0;
    while (verifyStatus === 'running' || verifyStatus === 'pending' || verifyStatus === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      verifyStatus = await bridge.getSessionStatus(verifySessionId);
      console.log(`Verification status: ${verifyStatus}`);
      verifyAttempts++;
      if (verifyAttempts > 12) break;
    }

    const messagesResult = await bridge['client'].session.messages({
      path: { id: verifySessionId }
    });

    if (messagesResult.error || !messagesResult.data) {
      console.log('Failed to fetch messages.');
      return;
    }

    const messages = messagesResult.data;
    console.log(`Messages count: ${messages.length}`);
    
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) {
      console.log('No messages found.');
      return;
    }

    console.log('\n--- Agent Output ---');
    console.log(lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'));

    const content = lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
    if (content.includes('VERIFIED-SAFE-EXECUTION')) {
      console.log('\n✨ US-1 Verification PASSED!');
    } else {
      console.log('\n❌ US-1 Verification FAILED: Content not found in agent output.');
    }

  } catch (error: any) {
    console.error('\n❌ Verification FAILED!');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error message:', error.message);
    }
  }
}

verifySafeExecution();
