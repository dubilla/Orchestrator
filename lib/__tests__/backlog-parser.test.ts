import {
  parseBacklogMarkdown,
  calculateSimilarity,
  findBestMatch,
  SIMILARITY_THRESHOLD,
} from '../backlog-parser';

describe('parseBacklogMarkdown', () => {
  it('parses unchecked heading items', () => {
    const markdown = `# Backlog

### [ ] First task

### [ ] Second task
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toBe('First task');
    expect(result.items[0].checked).toBe(false);
    expect(result.items[0].lineNumber).toBe(3);
    expect(result.items[1].content).toBe('Second task');
    expect(result.items[1].checked).toBe(false);
    expect(result.items[1].lineNumber).toBe(5);
  });

  it('parses checked heading items', () => {
    const markdown = `### [x] Done task

### [X] Also done task
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].checked).toBe(true);
    expect(result.items[1].checked).toBe(true);
  });

  it('parses mixed checked and unchecked items', () => {
    const markdown = `# Backlog

### [ ] Pending task

### [x] Completed task

### [ ] Another pending task
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].checked).toBe(false);
    expect(result.items[1].checked).toBe(true);
    expect(result.items[2].checked).toBe(false);
  });

  it('ignores non-heading checkbox lines', () => {
    const markdown = `# Backlog
Some description text

- [ ] Regular checkbox (ignored)
### [ ] Actual task
* Bullet point
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('Actual task');
  });

  it('parses items with emojis', () => {
    const markdown = `### [x] ✅ Slice 1: Completed feature

### [ ] 🚀 Slice 2: Next feature
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toBe('✅ Slice 1: Completed feature');
    expect(result.items[0].checked).toBe(true);
    expect(result.items[1].content).toBe('🚀 Slice 2: Next feature');
    expect(result.items[1].checked).toBe(false);
  });

  it('captures description between headings', () => {
    const markdown = `### [ ] Slice 1: Feature

**User Value**: User can do something

**Work**:
- Task 1
- Task 2

---

### [ ] Slice 2: Another feature

**User Value**: User can do something else
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].content).toBe('Slice 1: Feature');
    expect(result.items[0].description).toBe(`**User Value**: User can do something

**Work**:
- Task 1
- Task 2`);
    expect(result.items[1].content).toBe('Slice 2: Another feature');
    expect(result.items[1].description).toBe('**User Value**: User can do something else');
  });

  it('handles items with no description', () => {
    const markdown = `### [ ] Empty slice

### [ ] Another empty slice
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].description).toBe('');
    expect(result.items[1].description).toBe('');
  });

  it('handles whitespace variations', () => {
    const markdown = `### [ ] Normal spacing
###  [ ]  Extra spaces
### [ ]   Content with trailing space
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].content).toBe('Normal spacing');
    expect(result.items[1].content).toBe('Extra spaces');
    expect(result.items[2].content).toBe('Content with trailing space');
  });

  it('ignores empty heading checkbox items', () => {
    const markdown = `### [ ]
### [ ] Valid task
### [ ]
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('Valid task');
  });

  it('generates consistent hash for same content', () => {
    const markdown = '### [ ] Task one\n### [ ] Task two\n';
    const result1 = parseBacklogMarkdown(markdown);
    const result2 = parseBacklogMarkdown(markdown);

    expect(result1.hash).toBe(result2.hash);
  });

  it('generates different hash for different content', () => {
    const markdown1 = '### [ ] Task one\n';
    const markdown2 = '### [ ] Task two\n';
    const result1 = parseBacklogMarkdown(markdown1);
    const result2 = parseBacklogMarkdown(markdown2);

    expect(result1.hash).not.toBe(result2.hash);
  });

  it('handles empty markdown', () => {
    const result = parseBacklogMarkdown('');
    expect(result.items).toHaveLength(0);
    expect(result.hash).toBeDefined();
  });

  it('captures full slice with all sections', () => {
    const markdown = `### [ ] 🚀 Slice 6: Configure Budget Definitions

**User Value**: Dan can define custom budgets with targets and carryover rules through the UI

**Work**:
- DB: Budget definition schema (name, monthly target, carryover rules, split rules)
- Service: Budget CRUD operations
- API: Budget management endpoints
- UI: Budget definition form (name, target, carryover rules)
- UI: Duplicate budget for new time period
- Tests: Budget configuration and calculation with custom rules

**Definition of Done**: Create/edit budgets with custom targets and rules, see calculations use new definitions
`;
    const result = parseBacklogMarkdown(markdown);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].content).toBe('🚀 Slice 6: Configure Budget Definitions');
    expect(result.items[0].description).toContain('**User Value**:');
    expect(result.items[0].description).toContain('**Work**:');
    expect(result.items[0].description).toContain('**Definition of Done**:');
  });
});

describe('calculateSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(calculateSimilarity('hello', 'hello')).toBe(1);
  });

  it('returns 1 for case-insensitive matches', () => {
    expect(calculateSimilarity('Hello', 'HELLO')).toBe(1);
  });

  it('returns 0 for completely different strings', () => {
    const similarity = calculateSimilarity('abc', 'xyz');
    expect(similarity).toBeLessThan(0.5);
  });

  it('handles empty strings', () => {
    expect(calculateSimilarity('', '')).toBe(1);
    expect(calculateSimilarity('hello', '')).toBe(0);
    expect(calculateSimilarity('', 'hello')).toBe(0);
  });

  it('calculates high similarity for minor changes', () => {
    const similarity = calculateSimilarity(
      'Add user authentication',
      'Add user authentication feature'
    );
    expect(similarity).toBeGreaterThan(0.7);
  });

  it('calculates lower similarity for significant changes', () => {
    const similarity = calculateSimilarity(
      'Add user authentication',
      'Remove database connections'
    );
    expect(similarity).toBeLessThan(0.5);
  });
});

describe('findBestMatch', () => {
  const existingItems = [
    { content: 'Implement user login', id: '1' },
    { content: 'Add password reset feature', id: '2' },
    { content: 'Create dashboard page', id: '3' },
  ];

  it('finds exact match', () => {
    const result = findBestMatch('Implement user login', existingItems);

    expect(result).not.toBeNull();
    expect(result!.item.id).toBe('1');
    expect(result!.similarity).toBe(1);
  });

  it('finds similar match', () => {
    const result = findBestMatch('Implement user login system', existingItems);

    expect(result).not.toBeNull();
    expect(result!.item.id).toBe('1');
    expect(result!.similarity).toBeGreaterThan(SIMILARITY_THRESHOLD);
  });

  it('returns null when no match above threshold', () => {
    const result = findBestMatch('Something completely different', existingItems);

    expect(result).toBeNull();
  });

  it('returns best match when multiple items are similar', () => {
    const items = [
      { content: 'Add user feature', id: '1' },
      { content: 'Add user authentication', id: '2' },
      { content: 'Add user authentication feature', id: '3' },
    ];

    const result = findBestMatch('Add user authentication', items);

    expect(result).not.toBeNull();
    expect(result!.item.id).toBe('2');
    expect(result!.similarity).toBe(1);
  });

  it('handles empty existing items', () => {
    const result = findBestMatch('Any content', []);
    expect(result).toBeNull();
  });
});
