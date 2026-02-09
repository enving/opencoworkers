import { SkillRegistry } from './skill-registry.js';
import path from 'path';

async function testRegistry() {
    const repoRoot = '/home/enving/Dev/Repositories/opencoworkers'; // Hardcoded for test script
    const registry = new SkillRegistry(path.join(repoRoot, 'vendor', 'openclaw'));

    console.log('Scanning skills...');
    const skills = await registry.scan();

    console.log(`Found ${skills.length} skills.`);
    console.log('--- Sample Skill: github ---');
    const github = registry.getSkill('github');
    if (github) {
        console.log(`Name: ${github.name} ${github.emoji}`);
        console.log(`Desc: ${github.description}`);
        console.log(`Requires: ${github.requiresBins.join(', ')}`);
        console.log(`Path: ${github.path}`);
    } else {
        console.log('Github skill not found!');
    }

    console.log('\n--- Prompt Snippet ---');
    console.log(registry.getSkillsPromptSnippet().substring(0, 500) + '...');
}

testRegistry().catch(console.error);
