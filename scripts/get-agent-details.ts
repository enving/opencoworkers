import axios from 'axios';

const REMOTE_URL = process.env.OPENCODE_SERVER_URL || 'http://localhost:4096';
const AUTH = {
  username: 'opencode',
  password: 'opencode-sandbox'
};

async function getAgent(agentName: string) {
  try {
    const resp = await axios.get(`${REMOTE_URL}/agent/${agentName}`, { auth: AUTH });
    console.log(JSON.stringify(resp.data, null, 2));
  } catch (error: any) {
    console.error(error.message);
  }
}

getAgent('build');
