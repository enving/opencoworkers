import axios from 'axios';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';
const AUTH = {
  username: 'opencode',
  password: 'opencode-sandbox'
};

async function getSession(sessionId: string) {
  try {
    const resp = await axios.get(`${REMOTE_URL}/session/${sessionId}`, { auth: AUTH });
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (error: any) {
    console.error(error.message);
  }
}

const sid = process.argv[2];
if (sid) getSession(sid);
else console.log("Usage: npx tsx get-session-details.ts <sessionId>");
