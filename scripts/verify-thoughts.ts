
import { OpenCodeServerBridge } from './services/daemon/server/bridge.js';
import { jest } from '@jest/globals';
import { EventEmitter } from 'events';

// Mock SSEClient
class MockSSEClient extends EventEmitter {
  constructor() {
    super();
  }
  close() {}
}

// Mock AuditLogger
class MockAuditLogger {
  logs: any[] = [];
  async logAction(action: any) {
    this.logs.push(action);
    console.log('[MockAuditLogger]', action.action, action.thoughtId || '(no thought)');
  }
}

async function runVerification() {
  console.log('--- Starting Thought Loop & Provenance Verification ---');

  const config = {
    baseUrl: 'http://localhost:7852',
    directory: '/tmp',
    memoryDir: '/tmp/memory'
  };

  const bridge = new OpenCodeServerBridge(config);
  
  // Inject mock logger
  const mockLogger = new MockAuditLogger();
  (bridge as any).auditLogger = mockLogger;

  // Mock SSE connection
  const mockSSE = new MockSSEClient();
  (bridge as any).eventStream = mockSSE;

  let receivedThought: any = null;
  bridge.on('thought_updated', (data) => {
    receivedThought = data;
    console.log('[Bridge Event] thought_updated:', data.thoughtId, data.content.substring(0, 20) + '...');
  });

  console.log('1. Simulating Thinking Block (<think> type)...');
  mockSSE.emit('message', {
    data: JSON.stringify({
      type: 'message.part.updated',
      properties: {
        sessionID: 'session-123',
        part: {
          type: 'thinking',
          text: 'I am analyzing the requirements'
        }
      }
    })
  });

  if (receivedThought && receivedThought.content === 'I am analyzing the requirements') {
    console.log('✅ Task 1 Success: Thinking block detected and emitted.');
  } else {
    console.log('❌ Task 1 Failed: Thinking block not detected.');
  }

  const thoughtId = receivedThought?.thoughtId;

  console.log('2. Simulating Tool Permission Request...');
  // First, register the taskId for the session
  (bridge as any).sessionTaskMap.set('session-123', 'TASK-001');

  mockSSE.emit('message', {
    data: JSON.stringify({
      type: 'permission.asked',
      properties: {
        sessionID: 'session-123',
        requestID: 'req-456',
        tool: 'bash',
        permission: 'run'
      }
    })
  });

  const lastLog = mockLogger.logs[mockLogger.logs.length - 2]; // permission_asked is logged before permission_granted
  if (lastLog && lastLog.action === 'permission_asked' && lastLog.thoughtId === thoughtId && lastLog.taskId === 'TASK-001') {
    console.log('✅ Task 3 Success: Audit log linked to Thought ID and Task ID.');
  } else {
    console.log('❌ Task 3 Failed: Audit log linkage failed.', lastLog);
  }

  console.log('3. Simulating Thought Completion (Text part)...');
  mockSSE.emit('message', {
    data: JSON.stringify({
      type: 'message.part.updated',
      properties: {
        sessionID: 'session-123',
        part: {
          type: 'text',
          text: 'Analysis complete.'
        }
      }
    })
  });

  if (receivedThought && receivedThought.isComplete === true) {
    console.log('✅ Task 1 Success: Thought completion detected.');
  } else {
    console.log('❌ Task 1 Failed: Thought completion not detected.');
  }

  console.log('--- Verification Complete ---');
}

runVerification().catch(console.error);
