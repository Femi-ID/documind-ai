import { Test, TestingModule } from '@nestjs/testing';
import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChunkingService],
    }).compile();

    service = module.get<ChunkingService>(ChunkingService);
  });

  describe('chunkText', () => {
    it('should return an empty array for empty input', async () => {
      const result = await service.chunkText('');
      expect(result).toEqual([]);
    });

    it('should return an empty array for whitespace-only input', async () => {
      const result = await service.chunkText('   \n\n   \t  ');
      expect(result).toEqual([]);
    });

    it('should return a single chunk for text shorter than the chunk size', async () => {
      const shortText = 'This is a short document with very little content.';
      const result = await service.chunkText(shortText);

      expect(result).toHaveLength(1);
      expect(result[0].content).toContain('short document');
      expect(result[0].chunkIndex).toBe(0);
    });

    it('should produce multiple chunks for text longer than the chunk size', async () => {
      // Generate text large enough to require multiple chunks
      // Roughly 4 characters per token, 512 tokens = ~2048 chars per chunk
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(500); // ~14,000 chars
      const result = await service.chunkText(longText);

      expect(result.length).toBeGreaterThan(1);
    });

    it('should assign sequential chunkIndex values starting from 0', async () => {
      const longText = 'Lorem ipsum dolor sit amet. '.repeat(500);
      const result = await service.chunkText(longText);

      result.forEach((chunk, idx) => {
        expect(chunk.chunkIndex).toBe(idx);
      });
    });

    it('should include required fields on every chunk', async () => {
      const text = 'Lorem ipsum dolor sit amet. '.repeat(500);
      const result = await service.chunkText(text);

      result.forEach((chunk) => {
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('chunkIndex');
        expect(chunk).toHaveProperty('tokenCount');
        expect(chunk).toHaveProperty('startCharOffset');
        expect(chunk).toHaveProperty('endCharOffset');
        expect(typeof chunk.content).toBe('string');
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('should produce chunks with overlap (last N tokens of chunk M appear in chunk M+1)', async () => {
      const text =
        'Lorem ipsum dolor sit amet consectetur adipiscing elit. '.repeat(500);
      const result = await service.chunkText(text);

      // For each pair of consecutive chunks, the second's start should be
      // before the first's end (i.e., they overlap)
      for (let i = 0; i < result.length - 1; i++) {
        const current = result[i];
        const next = result[i + 1];
        expect(next.startCharOffset).toBeLessThan(current.endCharOffset);
      }
    });

    it('should not produce chunks exceeding the maximum token count', async () => {
      const text = 'Lorem ipsum dolor sit amet. '.repeat(1000);
      const result = await service.chunkText(text);

      // Allow some headroom — tokenizers aren't perfectly precise
      // Adjust this limit based on your actual chunk size constant
      const MAX_EXPECTED_TOKENS = 600;
      result.forEach((chunk) => {
        expect(chunk.tokenCount).toBeLessThanOrEqual(MAX_EXPECTED_TOKENS);
      });
    });

    it('should preserve the original text content across all chunks (no data loss)', async () => {
      const text = 'The quick brown fox jumps over the lazy dog. '.repeat(200);
      const result = await service.chunkText(text);

      // Concatenating all chunk contents (without dedup) should
      // contain at least the original character count (overlap adds extra)
      const concatenated = result.map((c) => c.content).join('');
      expect(concatenated.length).toBeGreaterThanOrEqual(text.trim().length);
    });

    it('should handle text with special characters and Unicode', async () => {
      const text = 'Special chars: åéîõü ñ ç ß 中文 日本語 🚀 ✓. '.repeat(300);
      const result = await service.chunkText(text);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].content).toMatch(/[åéîõü]|[中日]|🚀/);
    });

    it('should handle text with mixed line breaks and paragraphs', async () => {
      const text =
        'Paragraph one with some content.\n\nParagraph two.\n\nParagraph three. '.repeat(
          100,
        );
      const result = await service.chunkText(text);

      expect(result.length).toBeGreaterThan(0);
      result.forEach((chunk) => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });
  });
});
