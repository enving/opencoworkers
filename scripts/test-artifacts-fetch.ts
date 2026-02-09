import { OpenCodeServerBridge } from '../services/daemon/server/bridge.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function testArtifacts() {
  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox',
    password: 'opencode-sandbox'
  });

  const sessionId = 'ses_4111838aaffezoLJgRS34WTsZU';
  console.log(`Testing artifact listing for session: ${sessionId}`);

  try {
    const status = await bridge.getSessionStatus(sessionId);
    console.log('Status:', status);
    const artifacts = await bridge.getArtifacts(sessionId);
    console.log('Artifacts found:', artifacts);
  } catch (err) {
    console.error(err);
  }
}

testArtifacts();
