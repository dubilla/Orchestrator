import { NextRequest, NextResponse } from 'next/server';
import { getAllSkills } from '@/lib/skill-reader';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/skills - List all available skills
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repositoryPath = searchParams.get('repositoryPath');

    const skills = getAllSkills(repositoryPath || undefined);

    return successResponse({
      skills: skills.map(skill => ({
        name: skill.name,
        description: skill.description,
        source: skill.source
      }))
    });
  } catch (error) {
    console.error('Error fetching skills:', error);
    return errorResponse('Failed to fetch skills', 500);
  }
}
