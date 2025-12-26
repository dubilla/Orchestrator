import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse } from '@/lib/api-response';
import fs from 'fs/promises';

// Parse markdown file for backlog items (lines with [ ] or [x] or emojis)
async function parseBacklogMarkdown(filePath: string) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const backlogItems: string[] = [];

    for (const line of lines) {
      // Match lines with checkboxes or common task emojis
      if (
        line.includes('- [ ]') ||
        line.includes('- [x]') ||
        line.includes('- [X]') ||
        line.includes('* [ ]') ||
        line.includes('* [x]') ||
        line.includes('* [X]') ||
        /^[-*]\s*(📝|✅|🚀|🎯|💡|🔧|🐛|📦|♻️|🎨|⚡️|🔥|📄|🧪|🔒|🔑|🌟|⭐|❗|❓|💭|👀|🚧|🏗️|📌|🎉)/.test(line.trim())
      ) {
        const itemText = line
          .replace(/^[-*]\s*/, '')
          .replace(/^\[.\]\s*/, '')
          .replace(/^(📝|✅|🚀|🎯|💡|🔧|🐛|📦|♻️|🎨|⚡️|🔥|📄|🧪|🔒|🔑|🌟|⭐|❗|❓|💭|👀|🚧|🏗️|📌|🎉)\s*/, '')
          .trim();

        if (itemText) {
          backlogItems.push(itemText);
        }
      }
    }

    return backlogItems;
  } catch (error) {
    console.error('Error parsing backlog markdown:', error);
    return [];
  }
}

// GET /api/orchestras/:id/backlog - Parse and return backlog items
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orchestra = await prisma.orchestra.findUnique({
      where: { id }
    });

    if (!orchestra) {
      return errorResponse('Orchestra not found', 404);
    }

    // Parse backlog markdown file (convention: backlog.md in repository root)
    const backlogPath = `${orchestra.repositoryPath}/backlog.md`;
    const backlogItems = await parseBacklogMarkdown(backlogPath);

    // Get or create backlog items in database
    const existingItems = await prisma.backlogItem.findMany({
      where: { orchestraId: id }
    });

    // Map existing items by content for quick lookup
    const existingItemsMap = new Map(
      existingItems.map(item => [item.content, item])
    );

    // Update or create items
    const items = [];
    for (let i = 0; i < backlogItems.length; i++) {
      const content = backlogItems[i];
      const existing = existingItemsMap.get(content);

      if (existing) {
        // Update position if needed
        if (existing.position !== i) {
          await prisma.backlogItem.update({
            where: { id: existing.id },
            data: { position: i }
          });
        }
        items.push({ ...existing, position: i });
      } else {
        // Create new item
        const newItem = await prisma.backlogItem.create({
          data: {
            orchestraId: id,
            content,
            position: i
          }
        });
        items.push(newItem);
      }
    }

    // Remove items that are no longer in the markdown
    const currentContents = new Set(backlogItems);
    for (const existing of existingItems) {
      if (!currentContents.has(existing.content)) {
        await prisma.backlogItem.delete({
          where: { id: existing.id }
        });
      }
    }

    return successResponse(items);
  } catch (error) {
    console.error('Error fetching backlog:', error);
    return errorResponse('Failed to fetch backlog', 500);
  }
}