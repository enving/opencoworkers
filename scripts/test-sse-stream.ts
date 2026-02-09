import EventSource from 'eventsource';

const url = 'http://localhost:3847/api/events';
console.log(`Connecting to daemon events at ${url}...`);

const es = new EventSource(url);

es.on('connected', (e) => {
  console.log('✅ Connected to daemon SSE');
});

es.on('agent_output', (e) => {
  console.log('🤖 Agent Output:', JSON.parse(e.data));
});

es.on('task_updated', (e) => {
  console.log('📝 Task Updated:', JSON.parse(e.data));
});

es.onerror = (err) => {
  console.error('❌ SSE Error:', err);
};

setTimeout(() => {
  console.log('Closing test...');
  es.close();
  process.exit(0);
}, 30000);
