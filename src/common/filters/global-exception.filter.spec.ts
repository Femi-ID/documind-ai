// Tests for the global exception filter — the centerpiece of
// consistent error responses across the entire API.
//
// What we test:
// - HttpException (BadRequest, Unauthorized, Forbidden, NotFound) mapped correctly
// - ValidationPipe errors (array of messages) handled
// - Prisma P2002 (unique constraint) → 409 Conflict
// - Prisma P2025 (not found) → 404 Not Found
// - Prisma P2003 (foreign key) → 400 Bad Request
// - Prisma validation errors → 400
// - Unknown errors → 500 with sanitized message (no internal details leaked)
// - Response shape is consistent across all error types

import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
// import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './global-exception.filter';
import { Prisma } from 'src/generated/prisma/client';

describe('GlobalExceptionFilter', () => {
  // to silence the logger during tests, i'm not testing the logger
  jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  let filter: GlobalExceptionFilter;
  let mockResponse: any;
  let mockRequest: any;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new GlobalExceptionFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'POST',
      url: '/api/v1/document/upload',
    };

    host = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  /**
   * Helper to extract what was passed to response.json().
   */
  const getResponseBody = () => mockResponse.json.mock.calls[0][0];

  describe('NestJS HttpException', () => {
    it('should handle BadRequestException with status 400', () => {
      const exception = new BadRequestException('Invalid input');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const body = getResponseBody();
      expect(body.statusCode).toBe(400);
      expect(body.message).toBe('Invalid input');
      expect(body.error).toBe('Bad Request');
    });

    it('should handle UnauthorizedException with status 401', () => {
      const exception = new UnauthorizedException('Token expired');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      const body = getResponseBody();
      expect(body.statusCode).toBe(401);
      expect(body.error).toBe('Unauthorized');
    });

    it('should handle NotFoundException with status 404', () => {
      const exception = new NotFoundException('Document not found');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const body = getResponseBody();
      expect(body.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
    });

    it('should handle ValidationPipe errors (array of messages)', () => {
      // ValidationPipe throws BadRequestException with this shape:
      // { statusCode: 400, message: ['field1 error', 'field2 error'], error: 'Bad Request' }
      const exception = new BadRequestException({
        statusCode: 400,
        message: ['email must be valid', 'password must be at least 8 chars'],
        error: 'Bad Request',
      });

      filter.catch(exception, host);

      const body = getResponseBody();
      expect(body.statusCode).toBe(400);
      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message).toContain('email must be valid');
      expect(body.message).toContain('password must be at least 8 chars');
    });
  });

  describe('Prisma known request errors', () => {
    /**
     * Helper to build a Prisma error with the right shape.
     */
    const buildPrismaError = (code: string, meta: Record<string, any> = {}) => {
      const err = new Prisma.PrismaClientKnownRequestError(
        `Prisma error ${code}`,
        {
          code,
          clientVersion: '5.0.0',
          meta,
        } as any,
      );
      return err;
    };

    it('should map P2002 (unique constraint) to 409 Conflict', () => {
      const exception = buildPrismaError('P2002', { target: ['email'] });
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(409);
      const body = getResponseBody();
      expect(body.statusCode).toBe(409);
      expect(body.error).toBe('Conflict');
      expect(body.message).toContain('email');
    });

    it('should map P2002 with multiple fields to a clear message', () => {
      const exception = buildPrismaError('P2002', {
        target: ['userId', 'name'],
      });
      filter.catch(exception, host);

      const body = getResponseBody();
      expect(body.message).toContain('userId');
      expect(body.message).toContain('name');
    });

    it('should map P2025 (record not found) to 404 Not Found', () => {
      const exception = buildPrismaError('P2025');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      const body = getResponseBody();
      expect(body.statusCode).toBe(404);
      expect(body.error).toBe('Not Found');
    });

    it('should map P2003 (foreign key violation) to 400 Bad Request', () => {
      const exception = buildPrismaError('P2003');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const body = getResponseBody();
      expect(body.statusCode).toBe(400);
      expect(body.error).toBe('Bad Request');
    });

    it('should map unknown Prisma error codes to 500', () => {
      const exception = buildPrismaError('P9999');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const body = getResponseBody();
      expect(body.statusCode).toBe(500);
    });
  });

  describe('Prisma validation errors', () => {
    it('should map PrismaClientValidationError to 400', () => {
      // Prisma's validation errors come from malformed queries
      const exception = new Prisma.PrismaClientValidationError(
        'Invalid argument type',
        { clientVersion: '5.0.0' } as any,
      );

      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const body = getResponseBody();
      expect(body.error).toBe('Bad Request');
    });
  });

  describe('unknown errors', () => {
    it('should map a generic Error to 500 Internal Server Error', () => {
      const exception = new Error('Something exploded');
      filter.catch(exception, host);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const body = getResponseBody();
      expect(body.statusCode).toBe(500);
      expect(body.error).toBe('Internal Server Error');
    });

    it('should NOT expose internal error details to the client', () => {
      const exception = new Error(
        'Database password is "supersecret123" at line 42',
      );
      filter.catch(exception, host);

      const body = getResponseBody();
      // Generic message should be returned — internal details stay in logs
      expect(body.message).not.toContain('supersecret123');
      expect(body.message).not.toContain('line 42');
    });

    it('should handle non-Error throws (strings, objects)', () => {
      filter.catch('a string was thrown', host);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      const body = getResponseBody();
      expect(body.statusCode).toBe(500);
    });

    it('should handle thrown null/undefined', () => {
      filter.catch(null, host);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('response shape consistency', () => {
    it('should always include statusCode, message, error, path, timestamp', () => {
      const exception = new BadRequestException('test');
      filter.catch(exception, host);

      const body = getResponseBody();
      expect(body).toHaveProperty('statusCode');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('path');
      expect(body).toHaveProperty('timestamp');
    });

    it('should include the request path in the response', () => {
      mockRequest.url = '/api/v1/conversation/abc-123';
      const exception = new BadRequestException('test');
      filter.catch(exception, host);

      const body = getResponseBody();
      expect(body.path).toBe('/api/v1/conversation/abc-123');
    });

    it('should include a valid ISO timestamp', () => {
      const exception = new BadRequestException('test');
      filter.catch(exception, host);

      const body = getResponseBody();
      // ISO 8601 format: 2026-06-15T14:30:00.000Z
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
