import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { inspect } from 'node:util';

/**
 * Shapes every error response as { statusCode, message, error } and makes
 * sure an unexpected failure never leaks internals (Razorpay/Mongo error
 * details, stack traces, secrets) to the client — specs/api-contract.md
 * Error Handling.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string'
            ? { statusCode: status, message: body, error: exception.name }
            : body,
        );
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error
        ? exception.stack
        : inspect(exception, { depth: 5 }),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}
