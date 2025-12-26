import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/orchestras - List all orchestras
export async function GET() {
  try {
    const orchestras = await prisma.orchestra.findMany({
      include: {
        agents: {
          where: {
            status: {
              not: 'TERMINATED'
            }
          }
        },
        backlogItems: {
          where: {
            status: {
              not: 'DONE'
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return successResponse(orchestras);
  } catch (error) {
    console.error('Error fetching orchestras:', error);
    return errorResponse('Failed to fetch orchestras', 500);
  }
}

// POST /api/orchestras - Create new orchestra
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, repositoryPath, githubRemote, wipLimit } = body;

    // Validate required fields
    if (!name || !repositoryPath) {
      return errorResponse('Missing required fields', 400);
    }

    const orchestra = await prisma.orchestra.create({
      data: {
        name,
        repositoryPath,
        ...(githubRemote && { githubRemote }),
        ...(wipLimit !== undefined && { wipLimit }),
      }
    });

    return successResponse(orchestra, 201);
  } catch (error) {
    console.error('Error creating orchestra:', error);
    return errorResponse('Failed to create orchestra', 500);
  }
}