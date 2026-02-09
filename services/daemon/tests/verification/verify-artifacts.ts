import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';
import axios from 'axios';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';
const AUTH = {
  username: 'opencode',
  password: 'opencode-sandbox'
};

async function verifyArtifacts() {
  console.log('🚀 Starting Verification for Artifacts (PPTX)...');

  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-artifacts',
    password: 'opencode-sandbox'
  });

  const testTask: Task = {
    id: 'TASK-ARTIFACT-VERIFY' as any,
    title: 'Create Sales Deck',
    description: 'Create a PowerPoint presentation with 1 slide titled "OpenCode Verification". Save it as "verification.pptx". IMPORTANT: The pptx skill scripts are at /root/.config/opencode/skill/pptx/scripts/. Please use absolute paths or copy them to your workspace.',
    status: 'in_progress',
    priority: 'high',
    skill: 'pptx', // Using the PPTX skill
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    console.log('--- Step 1: Trigger PPTX Task ---');
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
    console.log('✅ Task completed.');

    // DEBUG: Print session logs
    const sessionMessages = await bridge['client'].session.messages({
      path: { id: sessionId }
    });
    if (sessionMessages.data) {
      console.log('\n--- Task Session Output ---');
      const lastMsg = sessionMessages.data[sessionMessages.data.length - 1];
      if (lastMsg) {
         console.log(lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n'));
      }
    }

    console.log('\n--- Step 3: Verify Artifact on VPS ---');
    // We check if the file exists using the API/Agent
    const verifySessionResult = await bridge['client'].session.create({
      body: { title: 'Artifact Check' }
    });
    const verifySessionId = verifySessionResult.data!.id;

    const promptResult = await bridge['client'].session.promptAsync({
      path: { id: verifySessionId },
      body: {
        agent: 'general',
        parts: [{
          type: 'text',
          text: 'ls -F /root/sandbox/verify-artifacts/'
        }]
      }
    });

    console.log('Awaiting list output...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Simple wait

    const messagesResult = await bridge['client'].session.messages({
      path: { id: verifySessionId }
    });
    
    const messages = messagesResult.data!;
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
    
    console.log('--- File List ---');
    console.log(content);

    if (content.includes('verification.pptx')) {
      console.log('\n✨ Artifact Verification PASSED! verification.pptx found.');
    } else {
      console.log('\n❌ Artifact Verification FAILED: verification.pptx not found.');
    }

  } catch (error: any) {
    console.error('\n❌ Verification FAILED!');
    console.error(error);
  }
}

verifyArtifacts();
