import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectionPattern } from '../interfaces/injection-pattern.interface';

@Injectable()
export class PromptInjectionGuard implements CanActivate {
  private readonly logger = new Logger(PromptInjectionGuard.name);

  /**
   * Known prompt injection patterns, grouped by attack category.
   *
   * These catch the most common injection attempts:
   * - System prompt override: "ignore previous instructions"
   * - Role hijacking: "you are now a different AI"
   * - Prompt extraction: "repeat your system prompt"
   * - Instruction injection: "new rules: do X instead"
   * - JailBreaking: "DAN mode", "developer mode"
   *
   * Each pattern uses word boundaries (\b) to reduce false positives.
   * For example, "ignore previous instructions" triggers, but
   * "explain how to ignore noise in data" does not.
   */
  private readonly injectionPatterns: InjectionPattern[] = [
    // system prompt override attempts
    {
      pattern:
        /\bignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions|prompts|rules|guidelines)\b/i,
      category: 'system_override',
      description: 'Attempt to override system instructions',
    },
    {
      pattern:
        /\bdisregard\s+(all\s+)?(previous|prior|above|your)|s+(instructions|prompts|rules|context)\b/i,
      category: 'system_override',
      description: 'Attempt to disregard system context',
    },
    {
      pattern:
        /\bforget\s+(all\s+)?(previous|prior|your|above)\s+(instructions|context|rules|prompts)\b/i,
      category: 'system_override',
      description: 'Attempt to clear system instructions',
    },
    // role hijacking
    {
      pattern: /\byou\s+are\s+now\s+(a|an|the|my)/i,
      category: 'role_hijack',
      description: 'Attempt to reassign AI role',
    },
    {
      pattern: /\bact\s+as\s+(a|an|the|my|if)\b/i,
      category: 'role_hijack',
      description: 'Attempt to change AI behavior',
    },
    {
      pattern: /\bpretend\s+(to\s+be|you\s+are|that)\b/i,
      category: 'role_hijack',
      description: 'Attempt to override AI identity',
    },
    // prompt extraction
    {
      pattern:
        /\b(show|display|reveal|repeat|print|output)\s+(your|the|my)?\s*(system\s+)?(prompt|instructions|rules|guidelines)\b/i,
      category: 'prompt_extraction',
      description: 'Attempt to extract system prompt',
    },
    {
      pattern:
        /\bwhat\s+(are|is)\s+your\s+(system\s+)?(prompt|instructions|rules)\b/i,
      category: 'prompt_extraction',
      description: 'Attempt to reveal system prompt',
    },
    // instruction injection
    {
      pattern:
        /\b(new|updated|override|replace)\s+(instructions|rules|prompt|guidelines)\s*:/i,
      category: 'instruction_injection',
      description: 'Attempt to inject new instructions',
    },
    {
      pattern: /\bsystem\s*:\s*/i,
      category: 'instruction_injection',
      description: 'Attempt to inject system-level message',
    },
    // jailbreak patterns
    {
      pattern: /\b(DAN|developer)s+mode\b/i,
      category: 'jailbreak',
      description: 'Known jailbreak pattern',
    },
    {
      pattern: /\bdo\s+anything\s+now\b/i,
      category: 'jailbreak',
      description: 'DAN jailbreak pattern',
    },
    // Additional patterns to protect against common attacks:
    {
      pattern:
        /\b(show|display|print|reveal|output)\s+(me\s+)?(your|the)\s+(system\s+)?(prompt|instructions)\b/i,
      category: 'prompt_extraction',
      description: 'Attempt to display system prompt',
    },

    // Add to jailbreak category:
    {
      pattern: /\bDAN\s+mode\b/i,
      category: 'jailbreak',
      description: 'DAN jailbreak technique',
    },
    {
      pattern: /\bdeveloper\s+mode\b/i,
      category: 'jailbreak',
      description: 'Developer mode jailbreak',
    },
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const body = request.body;

    // only check endpoint that have a 'content' field
    const content = body?.content;
    if (!content || typeof content !== 'string') return true; // no 'content' in request.body

    const violations = this.detectInjection(content); // to check against all patterns

    if (violations.length > 0) {
      const categories = [...new Set(violations.map((v) => v.category))];
      this.logger.warn(
        `Prompt injection detected - categories: [${categories.join(', ')}] ` +
          `input preview: "${content.slice(0, 100)}...`,
      );

      throw new BadRequestException(
        `Your question could not be processed. Please rephrase your question to focus on the document content.`,
      );
    }
    return true;
  }

  private detectInjection(
    input: string,
  ): Array<{ category: string; description: string }> {
    const violations: Array<{ category: string; description: string }> = [];

    for (const { pattern, category, description } of this.injectionPatterns) {
      if (pattern.test(input)) {
        violations.push({ category, description });
      }
    }
    return violations;
  }
}
