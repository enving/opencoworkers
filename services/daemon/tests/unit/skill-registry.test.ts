import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as path from 'path';

jest.unstable_mockModule('fs/promises', () => ({
  readdir: jest.fn(),
  readFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
}));

const fs: any = await import('fs/promises');
const { SkillRegistry }: any = await import('../../skills/registry.js');

describe('SkillRegistry', () => {
  let registry: any;
  const workspaceRoot = '/mock/root';
  const skillDir = path.join(workspaceRoot, '.agent-config', 'skill');

  beforeEach(() => {
    registry = new SkillRegistry({ type: 'posix', rootPath: workspaceRoot });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should discover skills from .agent-config/skill directory', async () => {
    const mockDirs = [
      { name: 'pptx', isDirectory: () => true },
      { name: 'xlsx', isDirectory: () => true },
      { name: 'README.md', isDirectory: () => false }
    ];

    const mockPptxDoc = `
# PowerPoint Specialist
Description: Creates professional presentations.
Commands:
- \`/pptx\`
- \`/pptx-template\`
    `;

    fs.readdir.mockResolvedValue(mockDirs);
    fs.readFile.mockImplementation((path: string) => {
      if (path.includes('pptx/SKILL.md')) return Promise.resolve(mockPptxDoc);
      return Promise.resolve('# Generic Skill\nDescription: Generic');
    });

    const skills = await registry.discover();

    expect(skills.length).toBe(2);
    const pptx = registry.getSkill('PowerPoint Specialist');
    expect(pptx).toBeDefined();
    expect(pptx.commands).toContain('/pptx');
    expect(pptx.description).toContain('Creates professional presentations');
  });

  it('should generate agent instructions for a skill', async () => {
    const mockPptxDoc = '# PPTX\nDescription: PPT Builder\nCommands: - `/pptx`';
    fs.readdir.mockResolvedValue([{ name: 'pptx', isDirectory: () => true }]);
    fs.readFile.mockResolvedValue(mockPptxDoc);

    await registry.discover();
    const instruction = registry.getInstructionForSkill('PPTX');

    expect(instruction).toContain('Skill available: PPTX');
    expect(instruction).toContain('PPT Builder');
    expect(instruction).toContain('/pptx');
  });

  it('should return empty string for unknown skill instruction', () => {
    const instruction = registry.getInstructionForSkill('Unknown');
    expect(instruction).toBe('');
  });
});
