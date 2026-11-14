import { HttpStatus } from '@nestjs/common';
import { BaseException } from './base.exception';
import { ExceptionCode } from './exception-codes.enum';

export class UserNotFoundException extends BaseException {
  constructor(identifier: string) {
    super({
      code: ExceptionCode.USER_NOT_FOUND,
      message: `User not found: ${identifier}`,
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class UserAlreadyExistsException extends BaseException {
  constructor(email: string) {
    super({
      code: ExceptionCode.USER_ALREADY_EXISTS,
      message: `User already exists with email: ${email}`,
      statusCode: HttpStatus.CONFLICT,
    });
  }
}
