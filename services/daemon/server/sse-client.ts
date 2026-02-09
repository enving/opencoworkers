import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { URL } from 'url';

export class SSEClient extends EventEmitter {
  private req: http.ClientRequest | null = null;
  private url: string;
  private headers: Record<string, string>;
  private buffer: string = '';

  constructor(url: string, options: { headers?: Record<string, string> } = {}) {
    super();
    this.url = url;
    this.headers = options.headers || {};
    this.connect();
  }

  private connect() {
    const urlObj = new URL(this.url);
    const isHttps = urlObj.protocol === 'https:';
    const request = isHttps ? https.request : http.request;
    
    const options: http.RequestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...this.headers
      }
    };

    console.log(`[SSEClient] Connecting to ${this.url}`);

    this.req = request(options, (res) => {
      if (res.statusCode !== 200) {
        this.emit('error', { message: `Non-200 status code (${res.statusCode})`, code: res.statusCode });
        return;
      }

      res.setEncoding('utf8');
      
      // Emit open event
      // (bridge.ts doesn't strictly listen for open, but good to have)
      // this.emit('open');

      res.on('data', (chunk: string) => {
        this.buffer += chunk;
        this.processBuffer();
      });

      res.on('end', () => {
        this.emit('error', { message: 'Connection closed by server' });
      });
    });

    this.req.on('error', (err) => {
      this.emit('error', err);
    });

    this.req.end();
  }

  private processBuffer() {
    const lines = this.buffer.split(/\r\n|\r|\n/);
    // Keep the last incomplete chunk in the buffer
    this.buffer = lines.pop() || '';

    let currentEvent: any = { data: '' };
    
    for (const line of lines) {
      if (line.trim() === '') {
        // End of event
        if (currentEvent.data) {
          // Fire message event with a .data property, matching EventSource behavior
          this.emit('message', { data: currentEvent.data.trim() });
        }
        currentEvent = { data: '' };
        continue;
      }

      if (line.startsWith('data: ')) {
        currentEvent.data += line.substring(6) + '\n';
      } else if (line.startsWith('data:')) {
        currentEvent.data += line.substring(5) + '\n';
      }
      // We ignore 'event:', 'id:', 'retry:' for now as bridge.ts expects JSON in data
    }
  }

  close() {
    if (this.req) {
      this.req.destroy();
      this.req = null;
    }
  }
}
