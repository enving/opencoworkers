
import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function fixAndVerify() {
  console.log('🚀 Fixing and Verifying PPTX...');

  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-artifacts',
    password: 'opencode-sandbox'
  });

  // --- Step 1: Setup Environment with General Agent ---
  console.log('\n--- Step 1: Setup Environment (General Agent) ---');
  try {
    const setupSessionResult = await bridge['client'].session.create({
      body: { title: 'Setup PPTX' }
    });
    const setupSessionId = setupSessionResult.data!.id;
    console.log(`Setup Session: ${setupSessionId}`);

    const cmd = `
      echo "Starting Setup..."
      cp -r /root/.config/opencode/skill/pptx/scripts/ .
      ls -F scripts/
      echo "Setup Complete"
    `;

    await bridge['client'].session.promptAsync({
      path: { id: setupSessionId },
      body: {
        agent: 'general',
        parts: [{ type: 'text', text: cmd }]
      }
    });

    // Wait for setup
    console.log('Waiting for setup...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    // Check setup output
    const setupMessages = await bridge['client'].session.messages({ path: { id: setupSessionId } });
    if (setupMessages.data && setupMessages.data.length > 0) {
      const lastMsg = setupMessages.data[setupMessages.data.length - 1];
      const text = lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
      console.log('Setup Output:', text);
      
      if (!text.includes('Setup Complete')) {
        console.warn('⚠️ Setup might have failed or timed out.');
      }
    } else {
      console.warn('⚠️ No output from setup session.');
    }

  } catch (error) {
    console.error('Setup Failed:', error);
    return;
  }

  // --- Step 2: Trigger PPTX Task ---
  console.log('\n--- Step 2: Trigger PPTX Task ---');
  const testTask: Task = {
    id: 'TASK-ARTIFACT-VERIFY-FIX' as any,
    title: 'Create Sales Deck',
    description: 'Create a PowerPoint presentation with 1 slide titled "OpenCode Verification". Save it as "verification.pptx".',
    status: 'in_progress',
    priority: 'high',
    skill: 'pptx',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    const sessionId = await bridge.triggerTaskExecution(testTask);
    console.log(`Task Session: ${sessionId}`);
    
    // Wait for completion
    let status = 'running';
    let attempts = 0;
    while (status === 'running' || status === 'pending' || status === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await bridge.getSessionStatus(sessionId!);
      process.stdout.write('.');
      attempts++;
      if (attempts > 24) break;
    }
    console.log(`\nTask Status: ${status}`);

    // Check output
    const taskMessages = await bridge['client'].session.messages({ path: { id: sessionId! } });
    if (taskMessages.data && taskMessages.data.length > 0) {
        const lastMsg = taskMessages.data[taskMessages.data.length - 1];
        const text = lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
        console.log('Task Output:', text);
    }

  } catch (error) {
    console.error('Task Execution Failed:', error);
  }

  // --- Step 3: Verify Artifact ---
  console.log('\n--- Step 3: Verify Artifact ---');
  try {
      const verifySessionResult = await bridge['client'].session.create({
          body: { title: 'Verify Artifact' }
      });
      const verifySessionId = verifySessionResult.data!.id;
      
      await bridge['client'].session.promptAsync({
          path: { id: verifySessionId },
          body: {
              agent: 'general',
              parts: [{ type: 'text', text: 'ls -F verification.pptx' }]
          }
      });
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const verifyMessages = await bridge['client'].session.messages({ path: { id: verifySessionId } });
      const lastMsg = verifyMessages.data![verifyMessages.data!.length - 1];
      const text = lastMsg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
      console.log('Verification Output:', text);
      
      if (text.includes('verification.pptx')) {
          console.log('✅ SUCCESS: verification.pptx found!');
      } else {
          console.log('❌ FAILURE: verification.pptx not found.');
      }
  } catch (error) {
      console.error('Verification Failed:', error);
  }

}

fixAndVerify();
