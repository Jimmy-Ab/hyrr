import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  public readonly errorCode: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
    errorCode: string = 'BAD_REQUEST',
    details?: any,
  ) {
    super(
      {
        message,
        errorCode,
        statusCode,
        details,
      },
      statusCode,
    );
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class NotFoundAppException extends AppException {
  constructor(message: string = 'Resource not found', errorCode: string = 'NOT_FOUND') {
    super(message, HttpStatus.NOT_FOUND, errorCode);
  }
}

export class UnauthorizedAppException extends AppException {
  constructor(message: string = 'Unauthorized access', errorCode: string = 'UNAUTHORIZED') {
    super(message, HttpStatus.UNAUTHORIZED, errorCode);
  }
}

export class ForbiddenAppException extends AppException {
  constructor(message: string = 'Access forbidden', errorCode: string = 'FORBIDDEN') {
    super(message, HttpStatus.FORBIDDEN, errorCode);
  }
}

export class ValidationAppException extends AppException {
  constructor(message: string = 'Validation failed', details?: any) {
    super(message, HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', details);
  }
}
