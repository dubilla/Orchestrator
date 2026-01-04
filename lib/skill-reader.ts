import fs from 'fs';
import path from 'path';
import os from 'os';

export interface Skill {
  name: string;
  description: string;
  content: string;
  source: 'global' | 'local';
  filePath: string;
}

/**
 * Parse frontmatter from a markdown file
 */
function parseFrontmatter(content: string): { name: string; description: string; body: string } {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { name: '', description: '', body: content };
  }

  const frontmatter = match[1];
  const body = match[2];

  // Parse YAML-like frontmatter
  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
  const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

  return {
    name: nameMatch ? nameMatch[1].trim() : '',
    description: descMatch ? descMatch[1].trim() : '',
    body: body.trim()
  };
}

/**
 * Read skills from a directory
 */
function readSkillsFromDirectory(dir: string, source: 'global' | 'local'): Skill[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const skills: Skill[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillFile = path.join(dir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillFile)) continue;

      try {
        const content = fs.readFileSync(skillFile, 'utf-8');
        const { name, description, body } = parseFrontmatter(content);

        skills.push({
          name: name || entry.name,
          description,
          content: body,
          source,
          filePath: skillFile
        });
      } catch (error) {
        console.error(`Failed to read skill ${entry.name}:`, error);
      }
    }
  } catch (error) {
    console.error(`Failed to read skills directory ${dir}:`, error);
  }

  return skills;
}

/**
 * Get all available skills from global and local directories
 */
export function getAllSkills(repositoryPath?: string): Skill[] {
  const skills: Skill[] = [];

  // Read global skills
  const globalSkillsDir = path.join(os.homedir(), '.claude', 'skills');
  skills.push(...readSkillsFromDirectory(globalSkillsDir, 'global'));

  // Read local skills if repository path provided
  if (repositoryPath) {
    const localSkillsDir = path.join(repositoryPath, '.claude', 'skills');
    skills.push(...readSkillsFromDirectory(localSkillsDir, 'local'));
  }

  return skills;
}

/**
 * Get a specific skill by name
 */
export function getSkillByName(name: string, repositoryPath?: string): Skill | null {
  const skills = getAllSkills(repositoryPath);
  return skills.find(skill => skill.name === name) || null;
}
