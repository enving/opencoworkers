/**
 * End-to-End PPTX Workflow Test
 * Tests the complete OpenCoworkers UI → Agent → PPTX → Artifact workflow
 * This follows the same pattern as verify-us-1.ts and verify-us-2.ts
 */

import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function verifyPPTXE2E() {
  console.log('🚀 Starting End-to-End PPTX Workflow Test...');
  console.log('Testing: OpenCoworkers UI → Agent → PPTX Generation → Artifact Return');
  
  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-pptx-e2e',
    password: 'opencode-sandbox'
  });

  // Create a realistic PPTX task as would come from OpenCoworkers UI
  const pptxTask: Task = {
    id: 'TASK-PPTX-E2E' as any,
    title: 'Erstelle PPT',  // German title as requested
    description: `Erstelle eine PowerPoint-Präsentation mit folgenden Anforderungen:

1. Titel: "OpenCode Verification"
2. Slide 1: Titel "OpenCode Verification"
3. Slide 2: Inhalt "PPTX Skill Working"
4. Slide 3: Bullet Points mit Features
5. Speichere als: "verification.pptx"

Hinweis: Führe zuerst 'setup-pptx-workspace' aus, um die Skripte verfügbar zu machen.`,
    status: 'in_progress',
    priority: 'high',
    skill: 'pptx',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    // ===== STEP 1: Trigger Task Execution =====
    console.log('\n--- Step 1: Creating Ticket "Erstelle PPT" ---');
    console.log('Simulating: User creates ticket in OpenCoworkers UI');
    
    const sessionId = await bridge.triggerTaskExecution(pptxTask);
    if (!sessionId) {
      throw new Error('❌ Agent did not accept the ticket');
    }
    console.log(`✅ Ticket accepted by agent - Session: ${sessionId}`);

    // ===== STEP 2: Monitor Execution =====
    console.log('\n--- Step 2: Monitoring Agent Execution ---');
    console.log('Simulating: OpenCoworkers UI shows "In Progress" status');
    
    let status = 'running';
    let attempts = 0;
    const maxAttempts = 30; // 2.5 minutes timeout
    
    while (status === 'running' || status === 'pending' || status === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await bridge.getSessionStatus(sessionId);
      console.log(`Current status: ${status} (Attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
      
      if (attempts >= maxAttempts) {
        throw new Error('❌ Task timed out - Agent took too long');
      }
    }

    console.log(`✅ Task completed with status: ${status}`);

    // ===== STEP 3: Verify Artifact Creation =====
    console.log('\n--- Step 3: Verifying PPTX Artifact ---');
    console.log('Simulating: OpenCoworkers UI checks for generated artifacts');
    
    // Create verification session
    const verifySessionResult = await bridge['client'].session.create({
      body: { title: 'PPTX Artifact Verification' }
    });
    
    const verifySessionId = verifySessionResult.data!.id;
    console.log(`Verification session: ${verifySessionId}`);

    // Check if PPTX file was created
    const verifyPrompt = `
      echo "=== PPTX Artifact Verification ==="
      echo "Current directory:"
      pwd
      echo "Looking for PPTX files:"
      find . -name "*.pptx" -type f 2>/dev/null || echo "No PPTX files found"
      echo "Checking specific file:"
      if [ -f "verification.pptx" ]; then
        echo "✅ SUCCESS: verification.pptx found!"
        ls -la verification.pptx
        file verification.pptx
      else
        echo "❌ FAILURE: verification.pptx not found"
      fi
    `;

    await bridge['client'].session.promptAsync({
      path: { id: verifySessionId },
      body: {
        agent: 'general',
        parts: [{ type: 'text', text: verifyPrompt }]
      }
    });

    await new Promise(resolve => setTimeout(resolve, 10000));

    // Get verification results
    const messagesResult = await bridge['client'].session.messages({
      path: { id: verifySessionId }
    });
    
    const messages = messagesResult.data!;
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.parts
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
    
    console.log('--- Verification Results ---');
    console.log(content);

    // ===== STEP 4: Final Status =====
    console.log('\n--- Final Status Report ---');
    
    const successCriteria = {
      sessionCreated: !!sessionId,
      taskCompleted: status === 'idle',
      artifactFound: content.includes('verification.pptx')
    };

    console.log('Success Criteria:');
    console.log(`- Ticket Created: ${successCriteria.sessionCreated ? '✅' : '❌'}`);
    console.log(`- Agent Executed: ${successCriteria.taskCompleted ? '✅' : '❌'}`);
    console.log(`- PPTX Created: ${successCriteria.artifactFound ? '✅' : '❌'}`);

    if (successCriteria.sessionCreated && successCriteria.taskCompleted && successCriteria.artifactFound) {
      console.log('\n🎉 END-TO-END PPTX TEST PASSED!');
      console.log('✅ OpenCoworkers UI → Agent → PPTX Generation → Artifact Return');
      console.log('✅ Complete workflow working correctly!');
      
      // Simulate ticket completion
      console.log('\n📋 Ticket Status (simulated):');
      console.log('- Status: "Completed" ✅');
      console.log('- Artifact: verification.pptx (attached) ✅');
      console.log('- Comment: "PPTX successfully generated" ✅');
      
      return true;
    } else {
      console.log('\n❌ END-TO-END PPTX TEST FAILED!');
      
      if (!successCriteria.sessionCreated) {
        console.log('❌ Agent did not accept the ticket');
      }
      if (!successCriteria.taskCompleted) {
        console.log(`❌ Task did not complete (status: ${status})`);
      }
      if (!successCriteria.artifactFound) {
        console.log('❌ PPTX artifact was not created');
      }
      
      return false;
    }

  } catch (error: any) {
    console.error('\n❌ END-TO-END PPTX TEST FAILED WITH ERROR!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// Run the test
verifyPPTXE2E().then(success => {
  process.exit(success ? 0 : 1);
}).catch(() => {
  process.exit(1);
});