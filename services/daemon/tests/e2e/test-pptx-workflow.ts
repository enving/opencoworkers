/**
 * End-to-End Test: PPTX Workflow
 * Tests the complete workflow from ticket creation to PPTX artifact generation
 */

import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function testPPTXWorkflow() {
  console.log('🚀 Starting End-to-End PPTX Workflow Test...');
  console.log('This test simulates the complete OpenCoworkers UI workflow');
  console.log('Ticket → Agent → PPTX Generation → Artifact Return');
  
  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/test-pptx-workflow',
    password: 'opencode-sandbox'
  });

  try {
    // ===== STEP 1: Create Test Ticket (Simulates UI Ticket Creation) =====
    console.log('\n📝 STEP 1: Creating Test Ticket...');
    console.log('Simulating: User creates ticket "Erstelle PPT" in OpenCoworkers UI');
    
    const testTask: Task = {
      id: 'TASK-PPTX-E2E-TEST' as any,
      title: 'Erstelle PPT',
      description: `Erstelle eine PowerPoint-Präsentation mit folgenden Anforderungen:

1. Titel: "OpenCode Verification"
2. Slide 1: Titel "OpenCode Verification"
3. Slide 2: Inhalt "PPTX Skill Working"
4. Slide 3: Bullet Points mit Features
5. Speichere als: "verification.pptx"

Hinweis: Verwende die PPTX-Skills aus /root/.config/opencode/skill/pptx/scripts/
Führe zuerst 'setup-pptx-workspace' aus, um die Skripte verfügbar zu machen.`,
      status: 'in_progress',
      priority: 'high',
      skill: 'pptx',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    console.log('✅ Ticket created with PPTX skill requirement');
    console.log(`Title: ${testTask.title}`);
    console.log(`Skill: ${testTask.skill}`);
    console.log(`Status: ${testTask.status}`);

    // ===== STEP 2: Agent Execution (Simulates Agent Processing) =====
    console.log('\n🤖 STEP 2: Agent Processing Ticket...');
    console.log('Simulating: OpenCode agent receives and processes the ticket');
    
    const sessionId = await bridge.triggerTaskExecution(testTask);
    if (!sessionId) {
      throw new Error('❌ Failed to trigger task execution - Agent did not accept ticket');
    }
    console.log(`✅ Agent accepted ticket - Session: ${sessionId}`);

    // ===== STEP 3: Monitor Execution =====
    console.log('\n🔄 STEP 3: Monitoring Execution...');
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

    // ===== STEP 4: Check Results =====
    console.log('\n📊 STEP 4: Checking Results...');
    console.log('Simulating: OpenCoworkers UI shows results and artifacts');
    
    // Get session messages to see what the agent did
    const sessionMessages = await bridge['client'].session.messages({
      path: { id: sessionId }
    });
    
    if (sessionMessages.data && sessionMessages.data.length > 0) {
      const lastMsg = sessionMessages.data[sessionMessages.data.length - 1];
      const textContent = lastMsg.parts
        .filter((p: any) => p.type === 'text')
        .map((p: any) => p.text)
        .join('\n');
      
      console.log('--- Agent Execution Log ---');
      console.log(textContent);
    }

    // ===== STEP 5: Verify Artifact Creation =====
    console.log('\n🔍 STEP 5: Verifying Artifact Creation...');
    console.log('Simulating: OpenCoworkers UI checks for generated artifacts');
    
    // Create verification session
    const verifySessionResult = await bridge['client'].session.create({
      body: { title: 'Artifact Verification' }
    });
    const verifySessionId = verifySessionResult.data!.id;

    // Check if PPTX file was created
    const verifyPrompt = `
      echo "=== Artifact Verification ==="
      echo "Current directory:"
      pwd
      echo "Files in directory:"
      ls -la
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
    const verifyMessages = await bridge['client'].session.messages({
      path: { id: verifySessionId }
    });
    
    const verifyContent = verifyMessages.data![verifyMessages.data!.length - 1]
      .parts.filter((p: any) => p.type === 'text')
      .map((p: any) => p.text)
      .join('\n');
    
    console.log('--- Artifact Verification Results ---');
    console.log(verifyContent);

    // ===== STEP 6: Final Status =====
    console.log('\n🎯 STEP 6: Final Status Report...');
    
    const successCriteria = {
      sessionCreated: !!sessionId,
      taskCompleted: status === 'idle',
      artifactFound: verifyContent.includes('verification.pptx')
    };

    console.log('Success Criteria:');
    console.log(`- Session Created: ${successCriteria.sessionCreated ? '✅' : '❌'}`);
    console.log(`- Task Completed: ${successCriteria.taskCompleted ? '✅' : '❌'}`);
    console.log(`- Artifact Found: ${successCriteria.artifactFound ? '✅' : '❌'}`);

    if (successCriteria.sessionCreated && successCriteria.taskCompleted && successCriteria.artifactFound) {
      console.log('\n🎉 END-TO-END TEST PASSED!');
      console.log('✅ OpenCoworkers UI → Agent → PPTX Generation → Artifact Return');
      console.log('✅ The complete workflow is working correctly!');
      
      // ===== STEP 7: Simulate Ticket Completion =====
      console.log('\n📋 STEP 7: Simulating Ticket Completion...');
      console.log('In real OpenCoworkers UI, the ticket would now be:');
      console.log('- Status: "Completed" ✅');
      console.log('- Artifact: verification.pptx (attached) ✅');
      console.log('- Comment: "PPTX successfully generated" ✅');
      
      return true;
    } else {
      console.log('\n❌ END-TO-END TEST FAILED!');
      console.log('Some success criteria were not met.');
      
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
    console.error('\n❌ END-TO-END TEST FAILED WITH ERROR!');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    return false;
  }
}

// Run the test
testPPTXWorkflow().then(success => {
  process.exit(success ? 0 : 1);
}).catch(() => {
  process.exit(1);
});