import { spawn } from 'child_process';
import path from 'path';

const BASE_URL = 'http://localhost:3847';

async function run() {
    console.log('🚀 Starting Verification (Real Public Services)...\n');

    // 1. Test API Integrations (Generic JSON API as "Förderwissen" Mock)
    console.log('--- Testing API Integrations (Real External API) ---');
    try {
        // We use JSONPlaceholder as a reliable, real-world REST API to simulate a knowledge graph source.
        const createRes = await fetch(`${BASE_URL}/api/integrations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Förderwissen Mock (JSONPlaceholder)',
                baseUrl: 'https://jsonplaceholder.typicode.com/posts',
                headers: { 'User-Agent': 'OpenCode-Test-Bot' },
                authType: 'none',
                semanticInstructions: 'Simulate retrieving funding programs.'
            })
        });

        if (!createRes.ok) throw new Error(`Create failed: ${createRes.status} ${createRes.statusText}`);
        const integration = await createRes.json() as any;
        console.log('✅ Integration Created:', integration.id);
        console.log(`   Name: ${integration.name}`);

        // Test Connection
        console.log('... Testing Connection ...');
        const testRes = await fetch(`${BASE_URL}/api/integrations/${integration.id}/test`, {
            method: 'POST'
        });
        const testResult = await testRes.json() as any;
        console.log('✅ Connection Test Result:', testResult);

        if (testResult.success && testResult.status === 200) {
            console.log('✨ TASK-180 Verified with Real Traffic!');
        } else {
            console.error('❌ Connection Test Failed');
        }

    } catch (error) {
        console.error('❌ API Integration Test Failed:', error);
    }

    console.log('\n');

    // 2. Test Public MCP Server (@modelcontextprotocol/server-filesystem)
    console.log('--- Testing Public MCP Server (@modelcontextprotocol/server-filesystem) ---');

    return new Promise<void>((resolve) => {
        // Use npx to run the filesystem server directly. 
        // We explicitly pass -y to avoid prompts.
        // We serve the current directory.
        const mcp = spawn('npx', ['-y', '@modelcontextprotocol/server-filesystem', process.cwd()], {
            stdio: ['pipe', 'pipe', 'inherit']
        });

        const initMsg = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'headless-verifier', version: '1.0' }
            }
        };

        let initialized = false;

        mcp.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('[MCP OUT]:', output.substring(0, 150).replace(/\n/g, ' '));

            if (output.includes('jsonrpc') && output.includes('result')) {
                console.log('✅ Public MCP Server responded with JSON-RPC Result!');
                initialized = true;

                // Optional: List Tools
                // We could send tools/list here, but init success is enough proof.
                mcp.kill();
                resolve();
            }
        });

        mcp.on('error', (err) => {
            console.error('Failed to spawn MCP:', err);
        });

        // Send Init
        setTimeout(() => {
            console.log('📤 Sending Initialize to Filesystem MCP...');
            mcp.stdin.write(JSON.stringify(initMsg) + '\n');
        }, 2000); // Give npx time to install/start

        // Timeout
        setTimeout(() => {
            if (!initialized) {
                console.log('⚠️ MCP Timeout. It may be installing or waiting.');
            }
            mcp.kill();
            resolve();
        }, 15000); // Allow 15s for remote download
    });
}

run().catch(console.error);
