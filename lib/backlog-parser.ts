import * as crypto from 'crypto';

export interface ParsedBacklogItem {
  content: string;
  description: string;
  checked: boolean;
  lineNumber: number;
}

export interface ParseResult {
  items: ParsedBacklogItem[];
  hash: string;
}

/**
 * Parses markdown content for backlog items in heading checkbox format:
 * ### [ ] Unchecked item (queued)
 * ### [x] Checked item (done)
 *
 * Each ### heading with a checkbox is a backlog item.
 * Content after the checkbox (including emojis) is the item title.
 * Everything between this heading and the next ### heading is the description.
 */
export function parseBacklogMarkdown(content: string): ParseResult {
  const lines = content.split('\n');
  const items: ParsedBacklogItem[] = [];

  // Pattern matches: ### [ ] or ### [x] or ### [X] followed by content
  // Allows for optional emojis and other text after the checkbox
  const headingCheckboxPattern = /^###\s+\[([ xX])\]\s+(.+)$/;

  // First pass: find all heading positions
  const headings: Array<{
    lineIndex: number;
    checked: boolean;
    content: string;
  }> = [];

  lines.forEach((line, index) => {
    const match = line.trim().match(headingCheckboxPattern);
    if (match) {
      const isChecked = match[1].toLowerCase() === 'x';
      const itemContent = match[2].trim();

      if (itemContent.length > 0) {
        headings.push({
          lineIndex: index,
          checked: isChecked,
          content: itemContent,
        });
      }
    }
  });

  // Second pass: extract description for each heading
  headings.forEach((heading, idx) => {
    const startLine = heading.lineIndex + 1;
    const endLine = idx < headings.length - 1
      ? headings[idx + 1].lineIndex
      : lines.length;

    // Collect lines between this heading and the next
    const descriptionLines: string[] = [];
    for (let i = startLine; i < endLine; i++) {
      const line = lines[i];
      // Stop at horizontal rule (slice separator)
      if (line.trim() === '---') break;
      descriptionLines.push(line);
    }

    // Trim empty lines from start and end
    while (descriptionLines.length > 0 && descriptionLines[0].trim() === '') {
      descriptionLines.shift();
    }
    while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1].trim() === '') {
      descriptionLines.pop();
    }

    items.push({
      content: heading.content,
      description: descriptionLines.join('\n'),
      checked: heading.checked,
      lineNumber: heading.lineIndex + 1, // 1-based line numbers
    });
  });

  // Generate hash of the markdown content for change detection
  const hash = crypto.createHash('sha256').update(content).digest('hex');

  return { items, hash };
}

/**
 * Calculates similarity between two strings using Levenshtein distance.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const len1 = s1.length;
  const len2 = s2.length;

  // Create distance matrix
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  return 1 - distance / maxLen;
}

/**
 * Threshold for considering two items as matching.
 * 0.7 means 70% similarity required.
 */
export const SIMILARITY_THRESHOLD = 0.7;

/**
 * Finds the best match for a markdown item among existing backlog items.
 * Returns the matched item and similarity score, or null if no match found.
 */
export function findBestMatch<T extends { content: string }>(
  markdownContent: string,
  existingItems: T[]
): { item: T; similarity: number } | null {
  let bestMatch: { item: T; similarity: number } | null = null;

  for (const item of existingItems) {
    const similarity = calculateSimilarity(markdownContent, item.content);

    if (similarity >= SIMILARITY_THRESHOLD) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item, similarity };
      }
    }
  }

  return bestMatch;
}
