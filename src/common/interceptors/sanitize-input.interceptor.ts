import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class SanitizeInputInterceptor implements NestInterceptor {
  private readonly logger = new Logger(SanitizeInputInterceptor.name);

  // this interceptor runs before the request hits the controller.
  // it sanitizes string fields in the request body to prevent XSS and strip potentially dangerous content.
  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();

    if (request.body && typeof request.body === 'object') {
      request.body = this.sanitizeObject(request.body);
    }
    return next.handle();
  }

  /**
   * Recursively sanitize all string fields in an object.
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value); // if the value is a string then sanitize string  and return it as {key: 'value'}
      } else if (Array.isArray(value)) {
        // if the value is an array
        sanitized[key] = value.map(
          (item) =>
            typeof item === 'string'
              ? this.sanitizeString(item) // if the content is a string, sanitize it.
              : typeof item === 'object' && item !== null
                ? this.sanitizeObject(item) // if the content is an object recall this sanitizeObject()
                : item, // if none, just return the value
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value); // recall sanitizeObject()
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private sanitizeString(input: string): string {
    return input
      .trim()
      .replace(/<[^>]*>/g, '') //strip html tags
      .replace(/\0/g, '') //remove null bytes
      .replace(/\s+/g, ' '); // collapse whitespace
  }
}
