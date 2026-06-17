// What we test:
// - System prompt contains required safety/grounding rules
// - User prompt includes the question and chunks correctly
// - Conversation history is truncated to last N (10) messages
// - Citations format includes document name and page references
// - Behavior with no chunks (graceful empty context)
// - Behavior with empty history (first messages)

import { Test, TestingModule } from '@nestjs/testing';
import { ContextAssemblyService } from './context-assembly.service';

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextAssemblyService],
    }).compile();

    service = module.get<ContextAssemblyService>(ContextAssemblyService);
  });

  // ── Test helpers ──

  const buildMockChunk = (overrides: Partial<any> = {}) => ({
    id: 'chunk-id-1',
    content: 'This is the content of a relevant document chunk.',
    documentId: 'doc-id-1',
    originalFilename: 'test-document.pdf',
    pageNumber: 1,
    similarity: 0.85,
    ...overrides,
  });

  const buildMockMessage = (role: 'USER' | 'ASSISTANT', content: string) => ({
    role,
    content,
  });

  describe('assemblePrompt', () => {
    it('should return both systemPrompt and userPrompt', () => {
      const result = service.assemblePrompt(
        'What is the topic?',
        [buildMockChunk()],
        [],
      );

      expect(result).toHaveProperty('systemPrompt');
      expect(result).toHaveProperty('userPrompt');
      expect(typeof result.systemPrompt).toBe('string');
      expect(typeof result.userPrompt).toBe('string');
    });

    it('should include the user question in the user prompt', () => {
      const question = 'What are the key findings in section 3?';
      const { userPrompt } = service.assemblePrompt(
        question,
        [buildMockChunk()],
        [],
      );

      expect(userPrompt).toContain(question);
    });

    it('should include chunk content in the assembled context', () => {
      const chunk = buildMockChunk({
        content: 'The Earth orbits the Sun in an elliptical path.',
      });
      const { userPrompt } = service.assemblePrompt(
        'How does Earth move?',
        [chunk],
        [],
      );

      expect(userPrompt).toContain('Earth orbits the Sun');
    });

    it('should include document references for citations', () => {
      const chunk = buildMockChunk({
        originalFilename: 'research-paper.pdf',
        pageNumber: 5,
      });
      const { userPrompt } = service.assemblePrompt(
        'What does the paper say?',
        [chunk],
        [],
      );

      // The prompt should mention the source document so the LLM
      // can cite it. Exact format depends on your implementation —
      // adjust to match (e.g., [Doc: research-paper.pdf], [Source: ...])
      expect(userPrompt.toLowerCase()).toContain('research-paper.pdf');
    });

    it('should handle empty chunks array gracefully', () => {
      const { systemPrompt, userPrompt } = service.assemblePrompt(
        'What is this about?',
        [],
        [],
      );

      // Should still produce valid prompts, not throw
      expect(systemPrompt.length).toBeGreaterThan(0);
      expect(userPrompt).toContain('What is this about?');
    });

    it('should include multiple chunks in the context', () => {
      const chunks = [
        buildMockChunk({ id: 'c1', content: 'First chunk content.' }),
        buildMockChunk({ id: 'c2', content: 'Second chunk content.' }),
        buildMockChunk({ id: 'c3', content: 'Third chunk content.' }),
      ];
      const { userPrompt } = service.assemblePrompt(
        'Summarize this',
        chunks,
        [],
      );

      expect(userPrompt).toContain('First chunk content');
      expect(userPrompt).toContain('Second chunk content');
      expect(userPrompt).toContain('Third chunk content');
    });
  });

  describe('conversation history', () => {
    it('should include conversation history when provided', () => {
      const history = [
        buildMockMessage('USER', 'What is the document about?'),
        buildMockMessage('ASSISTANT', 'It covers backend engineering.'),
      ];
      const { userPrompt } = service.assemblePrompt(
        'Tell me more',
        [buildMockChunk()],
        history,
      );

      expect(userPrompt).toContain('backend engineering');
    });

    it('should not include history content when history array is empty', () => {
      const { userPrompt } = service.assemblePrompt(
        'First question',
        [buildMockChunk()],
        [],
      );

      // No previous-message markers should appear
      // Adjust this assertion to match your actual prompt format
      expect(userPrompt).not.toMatch(/previous.{0,20}(message|conversation)/i);
    });

    it('should truncate history to the last 10 messages when more are provided', () => {
      const history = Array.from({ length: 20 }, (_, i) =>
        buildMockMessage(
          i % 2 === 0 ? 'USER' : 'ASSISTANT',
          `Message number ${i}`,
        ),
      );
      const { userPrompt } = service.assemblePrompt(
        'Latest question',
        [buildMockChunk()],
        history,
      );

      // Earliest messages should NOT appear
      expect(userPrompt).not.toContain('Message number 0');
      expect(userPrompt).not.toContain('Message number 5');

      // Most recent messages SHOULD appear
      expect(userPrompt).toContain('Message number 19');
      expect(userPrompt).toContain('Message number 18');
    });

    it('should preserve order of history messages (oldest to newest)', () => {
      const history = [
        buildMockMessage('USER', 'Question one'),
        buildMockMessage('ASSISTANT', 'Answer one'),
        buildMockMessage('USER', 'Question two'),
        buildMockMessage('ASSISTANT', 'Answer two'),
      ];
      const { userPrompt } = service.assemblePrompt(
        'New question',
        [buildMockChunk()],
        history,
      );

      const oneIdx = userPrompt.indexOf('Question one');
      const twoIdx = userPrompt.indexOf('Question two');
      expect(oneIdx).toBeGreaterThan(-1);
      expect(twoIdx).toBeGreaterThan(oneIdx);
    });
  });

  describe('system prompt safety', () => {
    it('should instruct the LLM to ground answers in the provided documents', () => {
      const { systemPrompt } = service.assemblePrompt(
        'Q',
        [buildMockChunk()],
        [],
      );

      // The system prompt should explicitly tell the LLM to stay
      // grounded. Match against keywords likely to be in your prompt.
      const lower = systemPrompt.toLowerCase();
      expect(
        lower.includes('document') ||
          lower.includes('excerpt') ||
          lower.includes('context') ||
          lower.includes('provided'),
      ).toBe(true);
    });

    it('should instruct the LLM to cite sources', () => {
      const { systemPrompt } = service.assemblePrompt(
        'Q',
        [buildMockChunk()],
        [],
      );

      const lower = systemPrompt.toLowerCase();
      expect(lower.includes('cit') || lower.includes('source')).toBe(true);
    });

    it('should be consistent across calls (no randomness)', () => {
      const r1 = service.assemblePrompt('Q', [buildMockChunk()], []);
      const r2 = service.assemblePrompt('Q', [buildMockChunk()], []);
      expect(r1.systemPrompt).toBe(r2.systemPrompt);
    });
  });
});
