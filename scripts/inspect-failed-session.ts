
import { OpenCodeServerBridge } from '../services/daemon/server/bridge.js';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';

async function inspectSession() {
  const bridge = new OpenCodeServerBridge({
    baseUrl: REMOTE_URL,
    directory: '/root/sandbox/verify-artifacts',
    password: 'opencode-sandbox'
  });

  const sessionId = 'ses_4109d7c1cffeS476lDiYCvpREt';
  console.log(`Inspecting session: ${sessionId}`);

  try {
    const status = await bridge.getSessionStatus(sessionId);
    console.log('Status:', status);
    const sessionResult = await bridge['client'].session.get({ path: { id: sessionId } });
    console.log('Session:', JSON.stringify(sessionResult.data, null, 2));

    const messagesResult = await bridge['client'].session.messages({
      path: { id: sessionId }
    });

    if (messagesResult.error) {
      console.error('Error fetching messages:', messagesResult.error);
      return;
    }

    console.log(JSON.stringify(messagesResult.data, null, 2));
  } catch (err) {
    console.error(err);
  }
}

inspectSession();
