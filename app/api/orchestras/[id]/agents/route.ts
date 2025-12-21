import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/orchestras/:id/agents - List agents for an orchestra
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agents = await prisma.agent.findMany({
      where: { orchestraId: id },
      include: {
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        assignedItems: true
      }
    });

    return successResponse(agents);
  } catch (error) {
    console.error('Error fetching agents:', error);
    return errorResponse('Failed to fetch agents', 500);
  }
}

// POST /api/orchestras/:id/agents - Spawn new agent
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return errorResponse('Agent name is required', 400);
    }

    // Get orchestra to access repository path
    const orchestra = await prisma.orchestra.findUnique({
      where: { id }
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    // Create agent record
    // Note: Using stateless query() API - no session initialization needed
    const agent = await prisma.agent.create({
      data: {
        name,
        orchestraId: id,
        conversations: {
          create: {
            messages: {
              create: {
                role: 'SYSTEM',
                content: `You are ${name}, a Claude coding agent working in ${orchestra.repositoryPath}.`
              }
            }
          }
        }
      },
      include: {
        conversations: {
          include: {
            messages: true
          }
        }
      }
    });

    return successResponse(agent, 201);
  } catch (error) {
    console.error('Error creating agent:', error);
    return errorResponse('Failed to create agent', 500);
  }
}