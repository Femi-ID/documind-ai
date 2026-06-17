// Tests for the input sanitization interceptor — strips XSS,
// null bytes, and normalizes whitespace on every incoming request.
//
// What we test:
// - HTML/script tags stripped from strings
// - Null bytes removed
// - Whitespace normalized (trimmed and collapsed)
// - Recursive sanitization through nested objects
// - Recursive sanitization through arrays
// - Non-string values (numbers, booleans, null) preserved
// - Mixed-type arrays handled correctly
// - Empty/missing body doesn't crash

import { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { SanitizeInputInterceptor } from './sanitize-input.interceptor';

describe('SanitizeInputInterceptor', () => {
  let interceptor: SanitizeInputInterceptor;

  beforeEach(() => {
    interceptor = new SanitizeInputInterceptor();
  });

  /**
   * Helper: build an ExecutionContext with the given request body.
   * Calls the interceptor and returns the (mutated) request body.
   */
  const sanitize = (body: any): any => {
    const request = { body };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of('ok'),
    };

    interceptor.intercept(ctx, next);
    return request.body;
  };

  describe('string sanitization', () => {
    it('should strip simple HTML tags', () => {
      const result = sanitize({
        content: 'Hello <b>world</b>',
      });
      expect(result.content).toBe('Hello world');
    });

    it('should strip script tags and their attributes', () => {
      const result = sanitize({
        content: 'Hello <script src="evil.js">alert(1)</script> world',
      });
      expect(result.content).not.toContain('<script');
      expect(result.content).not.toContain('</script>');
    });

    it('should strip tags with attributes', () => {
      const result = sanitize({
        content: 'Click <a href="http://evil.com" onclick="hack()">here</a>',
      });
      expect(result.content).toBe('Click here');
    });

    it('should remove null bytes', () => {
      const result = sanitize({
        content: 'Hello\u0000world',
      });
      expect(result.content).toBe('Helloworld');
    });

    it('should trim leading and trailing whitespace', () => {
      const result = sanitize({
        content: '   What is AI?   ',
      });
      expect(result.content).toBe('What is AI?');
    });

    it('should collapse multiple whitespace characters into one', () => {
      const result = sanitize({
        content: 'What    is\n\nAI?',
      });
      expect(result.content).toBe('What is AI?');
    });

    it('should handle a clean string without modification', () => {
      const result = sanitize({
        content: 'What is the meaning of life?',
      });
      expect(result.content).toBe('What is the meaning of life?');
    });

    it('should preserve special characters that arent HTML', () => {
      const result = sanitize({
        content: "What's the difference between A & B? It's important!",
      });
      expect(result.content).toContain("'");
      expect(result.content).toContain('&');
      expect(result.content).toContain('!');
    });
  });

  describe('non-string preservation', () => {
    it('should preserve numbers', () => {
      const result = sanitize({ age: 25, score: 99.5 });
      expect(result.age).toBe(25);
      expect(result.score).toBe(99.5);
    });

    it('should preserve booleans', () => {
      const result = sanitize({ active: true, deleted: false });
      expect(result.active).toBe(true);
      expect(result.deleted).toBe(false);
    });

    it('should preserve null values', () => {
      const result = sanitize({ optional: null });
      expect(result.optional).toBeNull();
    });
  });

  describe('nested object sanitization', () => {
    it('should sanitize strings inside nested objects', () => {
      const result = sanitize({
        user: {
          name: '<b>Femi</b>',
          email: '  test@example.com  ',
        },
      });
      expect(result.user.name).toBe('Femi');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should sanitize through multiple levels of nesting', () => {
      const result = sanitize({
        level1: {
          level2: {
            level3: {
              value: '<script>bad</script>clean',
            },
          },
        },
      });
      expect(result.level1.level2.level3.value).toBe('badclean');
    });
  });

  describe('array sanitization', () => {
    it('should sanitize string items in an array', () => {
      const result = sanitize({
        tags: ['<b>tech</b>', '  ai  ', 'normal'],
      });
      expect(result.tags).toEqual(['tech', 'ai', 'normal']);
    });

    it('should sanitize objects inside arrays', () => {
      const result = sanitize({
        comments: [{ text: '<b>Comment 1</b>' }, { text: 'Comment\u00002' }],
      });
      expect(result.comments[0].text).toBe('Comment 1');
      expect(result.comments[1].text).toBe('Comment2');
    });

    it('should preserve non-string items in arrays', () => {
      const result = sanitize({
        mixed: ['<b>str</b>', 42, true, null],
      });
      expect(result.mixed[0]).toBe('str');
      expect(result.mixed[1]).toBe(42);
      expect(result.mixed[2]).toBe(true);
      expect(result.mixed[3]).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('should handle undefined body without crashing', () => {
      expect(() => sanitize(undefined)).not.toThrow();
    });

    it('should handle null body without crashing', () => {
      expect(() => sanitize(null)).not.toThrow();
    });

    it('should handle empty object', () => {
      const result = sanitize({});
      expect(result).toEqual({});
    });

    it('should handle string body (non-object) without crashing', () => {
      // Interceptor only sanitizes when body is an object;
      // primitive bodies are left alone (validation will catch them)
      expect(() => sanitize('raw string body')).not.toThrow();
    });

    it('should not crash on circular references in objects', () => {
      // Defensive — circular refs shouldn't happen in HTTP bodies
      // but the interceptor should fail gracefully if they do
      const circular: any = { name: 'test' };
      circular.self = circular;

      // We accept either: it sanitizes successfully OR throws.
      // We just don't want a process-killing infinite loop.
      // Wrap in a Promise.race with a timeout to be safe.
      const result = Promise.race([
        new Promise((resolve) => {
          try {
            sanitize(circular);
            resolve('completed');
          } catch (err) {
            resolve('threw');
          }
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('infinite loop')), 1000),
        ),
      ]);

      return expect(result).resolves.toMatch(/completed|threw/);
    });
  });
});
