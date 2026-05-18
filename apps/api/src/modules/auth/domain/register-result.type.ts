import { RegisteredUser } from './registered-user.type';

export interface RegisterResult {
  user: RegisteredUser;
  emailVerificationToken: string;
}
