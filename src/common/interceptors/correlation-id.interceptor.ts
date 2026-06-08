import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly HEADER_NAME = 'X-Request-ID';

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    //  use client provided ID if present if not generate one
    const correlationId =
      (request.headers['x-request-id'] as string) ?? randomUUID();

    // attach to request object so that services/guards can have access to it
    request['correlationId'] = correlationId;

    response.setHeader(this.HEADER_NAME, correlationId);
    return next.handle();
  }
}

// Adds a unique X-Request-ID to every request and response.
// Why this matters:
// - When a user reports "my upload failed", you can ask for the
//   request ID and trace it through your logs.
// - In production with multiple instances, correlation IDs let you
//   follow a single request across services.
