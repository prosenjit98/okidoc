import {
  ArgumentMetadata,
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  PipeTransform,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { ZodError, ZodTypeAny } from 'zod';

/** Validate a request body/query with a shared zod schema: `@Body(new Zod(schema)) dto`. */
export class Zod<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown, _meta: ArgumentMetadata) {
    return this.schema.parse(value ?? {});
  }
}

/** Domain error with a stable machine-readable code. */
export class AppError extends HttpException {
  constructor(status: number, public readonly code: string, message: string, public readonly details?: unknown) {
    super({ code, message, details }, status);
  }
}

export const bad = (code: string, message: string, details?: unknown) => new AppError(400, code, message, details);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const forbidden = (message = 'You do not have access to this', code = 'FORBIDDEN') => new AppError(403, code, message);
export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const unauthorized = (message = 'Please log in again', code = 'UNAUTHORIZED') => new AppError(401, code, message);

export function must<T>(v: T | null | undefined, what = 'Resource'): T {
  if (v === null || v === undefined) throw notFound(what);
  return v;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly log = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof ZodError) {
      const first = exception.issues[0];
      return res.status(400).json({
        code: 'VALIDATION',
        message: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input',
        details: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') return res.status(409).json({ code: 'DUPLICATE', message: 'That already exists' });
      if (exception.code === 'P2025') return res.status(404).json({ code: 'NOT_FOUND', message: 'Not found' });
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as any;
      if (typeof body === 'object' && body.code) return res.status(status).json(body);
      const message = typeof body === 'string' ? body : Array.isArray(body?.message) ? body.message.join(', ') : body?.message ?? exception.message;
      const code =
        exception instanceof NotFoundException
          ? 'NOT_FOUND'
          : exception instanceof ForbiddenException
            ? 'FORBIDDEN'
            : exception instanceof BadRequestException
              ? 'BAD_REQUEST'
              : `HTTP_${status}`;
      return res.status(status).json({ code, message });
    }
    this.log.error(exception instanceof Error ? exception.stack : String(exception));
    return res.status(500).json({ code: 'INTERNAL', message: 'Something went wrong. Please try again.' });
  }
}
