import { OpenCodeServerBridge } from '../../server/bridge.js';
import { Task } from '../../types/tasks.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function fixAndVerifyPPTX() {
  console.log('🔧 Fix and Verify PPTX Skill...');

  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/fix-pptx',
    password: 'opencode-sandbox'
  });

  await bridge.init();

  const fixTask: Task = {
    id: 'TASK-FIX-PPTX' as any,
    title: 'Fix PPTX Skill',
    description: `Fix PPTX skill by setting up proper paths and dependencies:

1. First, check if PPTX skill exists:
   ls -la /root/.config/opencode/skill/pptx/

2. Check if scripts directory exists:
   ls -la /root/.config/opencode/skill/pptx/scripts/

3. If scripts directory exists, copy it to workspace with absolute paths:
   cp -r /root/.config/opencode/skill/pptx/scripts/ /root/sandbox/fix-pptx/
   
4. If scripts don't exist, create minimal PPTX setup:
   mkdir -p /root/sandbox/fix-pptx/scripts
   
5. Set up Python environment for PPTX:
   which python3 || echo "Python3 not found"
   pip3 list | grep -E "(pptx|openpyxl)" || echo "Missing PPTX libraries"

6. Create a simple test presentation using direct Python:
cat > create_pptx.py << 'EOF'
#!/usr/bin/env python3
from pptx import Presentation
from pptx.util import Inches

try:
    prs = Presentation()
    slide = prs.slides.add_slide()
    title = slide.shapes.title
    title.text = "OpenCode Verification"
    prs.save('verification.pptx')
    print("SUCCESS: verification.pptx created")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
EOF

7. Run the script:
   python3 create_pptx.py

8. Verify the file was created:
   ls -la verification.pptx
   file verification.pptx

Please run each step and show all output including errors.`,
    status: 'in_progress',
    priority: 'high',
    skill: 'pptx',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
  };

  try {
    console.log('\n--- Step 1: Trigger PPTX Fix Task ---');
    const sessionId = await bridge.triggerTaskExecution(fixTask);
    if (!sessionId) {
      throw new Error('Failed to trigger PPTX fix task');
    }
    console.log(`✅ Session created: ${sessionId}`);

    console.log('\n--- Step 2: Monitor Execution ---');
    let status = 'running';
    let attempts = 0;
    while (status === 'running' || status === 'pending' || status === 'busy') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await bridge.getSessionStatus(sessionId);
      console.log(`Current status: ${status}`);
      attempts++;
      if (attempts > 30) { // 2.5 minutes timeout
        throw new Error('Task timed out');
      }
    }

    if (status !== 'idle') {
      throw new Error(`Task failed with status: ${status}`);
    }
    console.log('✅ Task completed.');

    console.log('\n--- Step 3: Verify PPTX File Created ---');
    const verifySessionResult = await bridge['client'].session.create({
      body: { title: 'PPTX Verification' }
    });
    const verifySessionId = verifySessionResult.data!.id;

    const promptResult = await bridge['client'].session.promptAsync({
      path: { id: verifySessionId },
      body: {
        agent: 'general',
        parts: [{
          type: 'text',
          text: 'ls -la /root/sandbox/fix-pptx/verification.pptx && echo "✅ PPTX FILE FOUND" || echo "❌ PPTX FILE MISSING"'
        }]
      }
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    const messagesResult = await bridge['client'].session.messages({
      path: { id: verifySessionId }
    });
    
    const messages = messagesResult.data!;
    const lastMessage = messages[messages.length - 1];
    const content = lastMessage.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n');
    
    console.log('--- Verification Result ---');
    console.log(content);

    if (content.includes('✅ PPTX FILE FOUND')) {
      console.log('\n🎉 PPTX FIX SUCCESSFUL! verification.pptx was created.');
    } else {
      console.log('\n❌ PPTX FIX FAILED: verification.pptx not found.');
    }

  } catch (error: any) {
    console.error('\n❌ PPTX Fix FAILED!');
    console.error('Error:', error.message);
  }
}

fixAndVerifyPPTX();