import { getAllSkills, getSkillByName } from '../skill-reader';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock fs module
jest.mock('fs');
jest.mock('os');

const mockFs = fs as jest.Mocked<typeof fs>;
const mockOs = os as jest.Mocked<typeof os>;

describe('skill-reader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.homedir.mockReturnValue('/home/testuser');
  });

  describe('getAllSkills', () => {
    it('should return empty array when global skills directory does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const skills = getAllSkills();

      expect(skills).toEqual([]);
    });

    it('should parse global skills correctly', () => {
      const globalSkillsDir = '/home/testuser/.claude/skills';

      mockFs.existsSync.mockImplementation((path) => {
        if (path === globalSkillsDir) return true;
        if (path === `${globalSkillsDir}/test-guidance/SKILL.md`) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        { name: 'test-guidance', isDirectory: () => true } as any,
        { name: 'README.md', isDirectory: () => false } as any,
      ]);

      mockFs.readFileSync.mockReturnValue(`---
name: test-guidance
description: Determines when to write tests
---

# Test Guidance

Test content here.`);

      const skills = getAllSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0]).toMatchObject({
        name: 'test-guidance',
        description: 'Determines when to write tests',
        source: 'global',
      });
      expect(skills[0].content).toContain('Test Guidance');
    });

    it('should parse both global and local skills', () => {
      const globalSkillsDir = '/home/testuser/.claude/skills';
      const localSkillsDir = '/path/to/repo/.claude/skills';

      mockFs.existsSync.mockImplementation((path) => {
        if (path === globalSkillsDir) return true;
        if (path === localSkillsDir) return true;
        if (path === `${globalSkillsDir}/test-guidance/SKILL.md`) return true;
        if (path === `${localSkillsDir}/custom-skill/SKILL.md`) return true;
        return false;
      });

      let callCount = 0;
      mockFs.readdirSync.mockImplementation((dir) => {
        callCount++;
        if (dir === globalSkillsDir) {
          return [{ name: 'test-guidance', isDirectory: () => true } as any];
        }
        if (dir === localSkillsDir) {
          return [{ name: 'custom-skill', isDirectory: () => true } as any];
        }
        return [];
      });

      mockFs.readFileSync.mockImplementation((filePath) => {
        if (typeof filePath === 'string' && filePath.includes('test-guidance')) {
          return `---
name: test-guidance
description: Global skill
---

Global content`;
        }
        return `---
name: custom-skill
description: Local skill
---

Local content`;
      });

      const skills = getAllSkills('/path/to/repo');

      expect(skills).toHaveLength(2);
      expect(skills[0].source).toBe('global');
      expect(skills[1].source).toBe('local');
    });

    it('should handle skills without frontmatter gracefully', () => {
      const globalSkillsDir = '/home/testuser/.claude/skills';

      mockFs.existsSync.mockImplementation((path) => {
        if (path === globalSkillsDir) return true;
        if (path === `${globalSkillsDir}/broken-skill/SKILL.md`) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        { name: 'broken-skill', isDirectory: () => true } as any,
      ]);

      mockFs.readFileSync.mockReturnValue('Just plain text without frontmatter');

      const skills = getAllSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('broken-skill'); // Falls back to directory name
      expect(skills[0].description).toBe('');
    });

    it('should skip directories without SKILL.md', () => {
      const globalSkillsDir = '/home/testuser/.claude/skills';

      mockFs.existsSync.mockImplementation((path) => {
        if (path === globalSkillsDir) return true;
        if (path === `${globalSkillsDir}/incomplete/SKILL.md`) return false;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        { name: 'incomplete', isDirectory: () => true } as any,
      ]);

      const skills = getAllSkills();

      expect(skills).toEqual([]);
    });
  });

  describe('getSkillByName', () => {
    it('should return skill by name', () => {
      const globalSkillsDir = '/home/testuser/.claude/skills';

      mockFs.existsSync.mockImplementation((path) => {
        if (path === globalSkillsDir) return true;
        if (path === `${globalSkillsDir}/test-guidance/SKILL.md`) return true;
        return false;
      });

      mockFs.readdirSync.mockReturnValue([
        { name: 'test-guidance', isDirectory: () => true } as any,
      ]);

      mockFs.readFileSync.mockReturnValue(`---
name: test-guidance
description: Test skill
---

Content`);

      const skill = getSkillByName('test-guidance');

      expect(skill).not.toBeNull();
      expect(skill?.name).toBe('test-guidance');
    });

    it('should return null when skill not found', () => {
      mockFs.existsSync.mockReturnValue(false);

      const skill = getSkillByName('nonexistent');

      expect(skill).toBeNull();
    });
  });
});
