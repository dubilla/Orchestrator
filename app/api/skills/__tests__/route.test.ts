import { GET } from '../route';
import { getAllSkills } from '@/lib/skill-reader';

// Mock Next.js server
jest.mock('next/server', () => ({
  NextResponse: {
    json: jest.fn((body, init) => ({
      status: init?.status || 200,
      json: async () => body,
    })),
  },
}));

// Mock skill-reader
jest.mock('@/lib/skill-reader');

const mockGetAllSkills = getAllSkills as jest.MockedFunction<typeof getAllSkills>;

describe('GET /api/skills', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return all skills without repository path', async () => {
    mockGetAllSkills.mockReturnValue([
      {
        name: 'test-guidance',
        description: 'Test skill',
        content: 'Content',
        source: 'global',
        filePath: '/path/to/skill'
      },
    ]);

    const request = {
      url: 'http://localhost:3000/api/skills'
    } as any;
    const response = await GET(request);
    const data = await response.json();

    expect(mockGetAllSkills).toHaveBeenCalledWith(undefined);
    expect(data.success).toBe(true);
    expect(data.data.skills).toHaveLength(1);
    expect(data.data.skills[0]).toMatchObject({
      name: 'test-guidance',
      description: 'Test skill',
      source: 'global',
    });
    // Should not include content or filePath in response
    expect(data.data.skills[0].content).toBeUndefined();
    expect(data.data.skills[0].filePath).toBeUndefined();
  });

  it('should return skills with repository path', async () => {
    mockGetAllSkills.mockReturnValue([
      {
        name: 'global-skill',
        description: 'Global',
        content: 'Content',
        source: 'global',
        filePath: '/global/path'
      },
      {
        name: 'local-skill',
        description: 'Local',
        content: 'Content',
        source: 'local',
        filePath: '/local/path'
      },
    ]);

    const request = {
      url: 'http://localhost:3000/api/skills?repositoryPath=/path/to/repo'
    } as any;
    const response = await GET(request);
    const data = await response.json();

    expect(mockGetAllSkills).toHaveBeenCalledWith('/path/to/repo');
    expect(data.success).toBe(true);
    expect(data.data.skills).toHaveLength(2);
  });

  it('should handle empty skills list', async () => {
    mockGetAllSkills.mockReturnValue([]);

    const request = {
      url: 'http://localhost:3000/api/skills'
    } as any;
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.skills).toEqual([]);
  });

  it('should handle errors gracefully', async () => {
    mockGetAllSkills.mockImplementation(() => {
      throw new Error('Failed to read skills');
    });

    const request = {
      url: 'http://localhost:3000/api/skills'
    } as any;
    const response = await GET(request);
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to fetch skills');
    expect(response.status).toBe(500);
  });
});
