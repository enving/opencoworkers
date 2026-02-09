/**
 * Comprehensive Headless API Test Suite
 * Tests ALL endpoints of the OpenCode PM-Sync server
 */

const BASE = 'http://localhost:3847';

interface TestResult {
    endpoint: string;
    method: string;
    status: 'pass' | 'fail' | 'skip';
    details?: string;
}

const results: TestResult[] = [];

async function apiRequest(method: string, path: string, body?: any): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body) {
        headers['Content-Type'] = 'application/json';
    }
    const opts: RequestInit = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    return fetch(`${BASE}${path}`, opts);
}

async function check(name: string, method: string, path: string, body?: any, expect = 200) {
    try {
        const res = await apiRequest(method, path, body);
        if (res.status === expect || (expect === 200 && res.ok)) {
            results.push({ endpoint: `${method} ${path}`, method, status: 'pass' });
            console.log(`✅ ${method} ${path}`);
        } else {
            const text = await res.text();
            results.push({ endpoint: `${method} ${path}`, method, status: 'fail', details: `Expected ${expect}, got ${res.status}: ${text}` });
            console.log(`❌ ${method} ${path} - Status ${res.status} - ${text}`);
        }
        return res;
    } catch (err: any) {
        results.push({ endpoint: `${method} ${path}`, method, status: 'fail', details: err.message });
        console.log(`❌ ${method} ${path} - ${err.message}`);
        throw err;
    }
}

async function run() {
    console.log('🚀 Starting Comprehensive API Test Suite\n');
    console.log('--- CORE ---');
    await check('Health', 'GET', '/health');

    console.log('\n--- TASKS ---');
    await check('List Tasks', 'GET', '/api/tasks');
    const createRes = await check('Create Task', 'POST', '/api/tasks', {
        title: 'Headless Test Task',
        description: 'Created by automated test',
        priority: 'low',
        status: 'pending'
    }, 201);
    let taskId = '';
    try {
        const result = await createRes.json() as { task?: { id: string } };
        taskId = result.task?.id || '';
        console.log(`   Created: ${taskId}`);
    } catch (e) { console.error('   Parse error:', e); }

    if (taskId) {
        await check('Get Task', 'GET', `/api/tasks/${taskId}`);
        await check('Update Task', 'PATCH', `/api/tasks/${taskId}`, { status: 'in_progress' });
    }

    console.log('\n--- SERVERS ---');
    await check('List Servers', 'GET', '/api/servers');

    console.log('\n--- INTEGRATIONS ---');
    await check('List Integrations', 'GET', '/api/integrations');
    const intRes = await check('Create Integration', 'POST', '/api/integrations', {
        name: 'Test Integration',
        baseUrl: 'https://httpbin.org/get',
        authType: 'none'
    }, 201);
    let intId = '';
    try {
        const int = await intRes.json() as { id: string };
        intId = int.id || '';
        console.log(`   Created: ${intId}`);
    } catch (e) { console.error('   Parse error:', e); }

    if (intId) {
        await check('Test Integration', 'POST', `/api/integrations/${intId}/test`);
        await check('Delete Integration', 'DELETE', `/api/integrations/${intId}`);
    }

    console.log('\n--- CONTEXT & METRICS ---');
    await check('Context Options', 'GET', '/api/context/options');
    await check('Metrics', 'GET', '/api/metrics');

    console.log('\n--- SKILLS & LOGS ---');
    await check('Skills', 'GET', '/api/skills');
    await check('Logs', 'GET', '/api/logs');

    console.log('\n--- SETTINGS ---');
    await check('Refinement Status', 'GET', '/api/settings/refinement-loop');

    console.log('\n--- STATUS & AGENTS ---');
    await check('Status', 'GET', '/api/status');
    await check('Agents', 'GET', '/api/agents');

    console.log('\n--- REPOS ---');
    await check('Repos', 'GET', '/api/repos');

    // Summary
    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    console.log(`\n========================================`);
    console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
    console.log(`========================================`);

    if (failed > 0) {
        console.log('\nFailed Tests:');
        results.filter(r => r.status === 'fail').forEach(r => {
            console.log(`  - ${r.endpoint}: ${r.details}`);
        });
    }
}

run().catch(console.error);
