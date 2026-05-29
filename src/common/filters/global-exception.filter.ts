import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
// import { Prisma } from '@prisma/client';
import { Prisma } from 'src/generated/prisma/client';

/**
 * Global exception filter that catches ALL exceptions and returns
 * a consistent JSON error response format.
 *
 * Handles:
 * - HttpException (NestJS built-in: 400, 401, 403, 404, 429, etc.)
 * - Prisma client errors (unique constraint, not found, foreign key)
 * - Validation errors (class-validator via ValidationPipe)
 * - Unexpected errors (500 Internal Server Error)
 *
 * Response shape:
 * {
 *   statusCode: number,
 *   message: string | string[],
 *   error: string,
 *   path: string,
 *   timestamp: string
 * }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number;
    let message: string | string[];
    let error: string;

    // ── 1. NestJS HttpException (includes ValidationPipe errors) ──
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      // ValidationPipe throws BadRequestException with { message: string[], error: string }
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, any>;
        message = res.message || exception.message;
        error = res.error || this.getErrorName(statusCode);
      } else {
        message = exception.message;
        error = this.getErrorName(statusCode);
      }
    }

    // ── 2. Prisma Known Request Errors ──
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        // Unique constraint violation
        case 'P2002': {
          statusCode = HttpStatus.CONFLICT;
          const fields =
            (exception.meta?.target as string[])?.join(', ') || 'field';
          message = `A record with this ${fields} already exists.`;
          error = 'Conflict';
          break;
        }
        // Record not found (for update/delete operations)
        case 'P2025': {
          statusCode = HttpStatus.NOT_FOUND;
          message = 'The requested record was not found.';
          error = 'Not Found';
          break;
        }
        // Foreign key constraint violation
        case 'P2003': {
          statusCode = HttpStatus.BAD_REQUEST;
          message = 'Operation failed due to a related record constraint.';
          error = 'Bad Request';
          break;
        }
        default: {
          statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'A database error occurred.';
          error = 'Internal Server Error';
        }
      }
      this.logger.error(
        `Prisma error ${exception.code}: ${exception.message}`,
        exception.stack,
      );
    }

    // ── 3. Prisma Validation Errors (malformed query) ──
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      statusCode = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided.';
      error = 'Bad Request';
      this.logger.error(`Prisma validation error: ${exception.message}`);
    }

    // ── 4. Unexpected / Unknown Errors ──
    else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred.';
      error = 'Internal Server Error';

      // Log the full error for debugging — never expose internals to the client
      const err =
        exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}: ${err.message}`,
        err.stack,
      );
    }

    response.status(statusCode).json({
      statusCode,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Maps HTTP status codes to standard error names.
   */
  private getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
    };
    return errorNames[statusCode] || 'Error';
  }
}
