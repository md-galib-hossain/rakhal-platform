import { BaseException } from './base.exception';
export declare class UserNotFoundException extends BaseException {
    constructor(identifier: string);
}
export declare class UserAlreadyExistsException extends BaseException {
    constructor(email: string);
}
