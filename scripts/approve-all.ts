import { EventSource } from 'eventsource';
import { createOpencodeClient } from "@opencode-ai/sdk";

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';
const password = 'opencode-sandbox';

async function approveAll() {
  console.log('🚀 Starting Universal Approver for VPS...');
  
  const auth = Buffer.from(`opencode:${password}`).toString('base64');
  const headers = { 'Authorization': `Basic ${auth}` };

  const client = createOpencodeClient({
    baseUrl: REMOTE_URL,
    headers
  });

  const es = new EventSource(`${REMOTE_URL}/global/event`, { headers });

  es.onmessage = async (e) => {
    try {
      const rawEvent = JSON.parse(e.data);
      const event = rawEvent.payload || rawEvent;
      
      console.log(`Event: ${event.type}`);

      if (event.type === "permission.asked") {
        const { requestID, tool, permission } = event.properties;
        const target = tool || permission;
        console.log(`🎯 Found prompt for ${target}. Approving...`);
        
        await client.permission.reply({
          path: { requestID },
          body: { reply: 'always' }
        });
        console.log(`✅ Approved ${requestID}`);
      }
    } catch (err) {
      console.error('Error:', err);
    }
  };

  es.onerror = (err) => {
    console.error('SSE Error:', err);
  };

  console.log('Listening for 2 minutes...');
  setTimeout(() => {
    console.log('Done.');
    es.close();
    process.exit(0);
  }, 120000);
}

approveAll();
